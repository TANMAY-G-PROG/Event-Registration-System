// ─── Supabase-compatible query adapter over Neon (pg) ──────────────────────────
// This lets the existing business logic routes (supabaseAdmin.from('table').select/insert/update/delete)
// run against Neon without rewriting every route.
//
// Supported subset:
//   .select(cols)  .eq(col,val)  .in(col,[vals])  .or(filter)  .limit(n)
//   .order(col, opts)  .maybeSingle()  .single()
//   .insert([rows]).select(cols)  .update(data).eq/.in  .delete().eq
//   .upsert([rows], {onConflict})
//   { count: 'exact', head: true }  (for .select with count)

function buildAdapter(pool) {
    async function runQuery(text, params) {
        const client = await pool.connect();
        try {
            const res = await client.query(text, params);
            return res;
        } finally {
            client.release();
        }
    }

    // Map Supabase join notation: "club:orgcid(cname)" → LEFT JOIN club ON event.orgcid = club.cid
    // This is a best-effort mapper for the joins used in this codebase.
    const JOIN_MAP = {
        // format: "alias:fk_col" → { table, alias, pk, cols }
        'club:orgcid': { table: 'club', fk: 'orgcid', pk: 'cid' },
        'club:clubid': { table: 'club', fk: 'clubid', pk: 'cid' },
        'student:orgusn': { table: 'student', fk: 'orgusn', pk: 'usn', alias: 'org_student' },
        'student:usn': { table: 'student', fk: 'usn', pk: 'usn', alias: 'st_student' },
        'event:parteid': { table: 'event', fk: 'parteid', pk: 'eid' },
        'event:volneid': { table: 'event', fk: 'volneid', pk: 'eid' },
        'sub_event_attendance:seid': { table: 'sub_event_attendance', fk: 'seid', pk: 'seid' },
        'team:team_id': { table: 'team', fk: 'team_id', pk: 'id' },
        'leader:leader_usn': { table: 'student', fk: 'leader_usn', pk: 'usn', alias: 'leader_student' },
        'student:student_usn': { table: 'student', fk: 'student_usn', pk: 'usn', alias: 'mem_student' },
    };

    function parseSelect(tableName, selectStr, opts = {}) {
        if (!selectStr || selectStr === '*') {
            return { cols: `"${tableName}".*`, joins: '', colMappings: {} };
        }
        const parts = selectStr.split(',').map(s => s.trim()).filter(Boolean);
        const directCols = [];
        const joins = [];
        const colMappings = {}; // alias → {joinAlias, requestedCols}

        for (const part of parts) {
            // Detect join notation e.g. "club:orgcid(cname)" or "student:orgusn(sname)"
            const joinMatch = part.match(/^(\w+):(\w+)\((.+)\)$/);
            if (joinMatch) {
                const [, alias, fkCol, requestedCols] = joinMatch;
                const key = `${alias}:${fkCol}`;
                const jm = JOIN_MAP[key];
                if (jm) {
                    const joinAlias = jm.alias || alias;
                    joins.push(`LEFT JOIN "${jm.table}" AS "${joinAlias}" ON "${tableName}"."${jm.fk}" = "${joinAlias}"."${jm.pk}"`);
                    const cols = requestedCols.split(',').map(c => c.trim());
                    colMappings[alias] = { joinAlias, cols };
                    for (const c of cols) {
                        directCols.push(`"${joinAlias}"."${c}" AS "${joinAlias}__${c}"`);
                    }
                } else {
                    // Unknown join — skip gracefully
                    console.warn(`[adapter] Unknown join mapping: ${key}`);
                }
            } else {
                directCols.push(`"${tableName}"."${part}"`);
            }
        }

        return {
            cols: directCols.length > 0 ? directCols.join(', ') : `"${tableName}".*`,
            joins: joins.join(' '),
            colMappings,
        };
    }

    // Rehydrate flat rows back into nested Supabase-style objects
    function rehydrate(rows, colMappings) {
        if (!rows || rows.length === 0) return rows;
        if (Object.keys(colMappings).length === 0) return rows;
        return rows.map(row => {
            const out = { ...row };
            for (const [alias, { joinAlias, cols }] of Object.entries(colMappings)) {
                const nested = {};
                let allNull = true;
                for (const c of cols) {
                    const key = `${joinAlias}__${c}`;
                    nested[c] = row[key];
                    if (row[key] !== null && row[key] !== undefined) allNull = false;
                    delete out[key];
                }
                out[alias] = allNull ? null : nested;
            }
            return out;
        });
    }

    // Parse Supabase .or() string e.g. "usn.eq.${usn},emailid.eq.${email}"
    function parseOrFilter(orStr, params) {
        const conditions = orStr.split(',').map(s => s.trim());
        const clauses = [];
        for (const cond of conditions) {
            const m = cond.match(/^(\w+)\.(\w+)\.(.+)$/);
            if (m) {
                const [, col, op, val] = m;
                params.push(val);
                if (op === 'eq') clauses.push(`"${col}" = $${params.length}`);
                else if (op === 'neq') clauses.push(`"${col}" != $${params.length}`);
            }
        }
        return clauses.join(' OR ');
    }

    function builder(tableName) {
        let _selectStr = '*';
        let _countOnly = false;
        let _headOnly = false;
        let _wheres = [];
        let _params = [];
        let _orderBy = null;
        let _limitN = null;
        let _operation = 'select';
        let _insertRows = null;
        let _updateData = null;
        let _returnSelect = null;
        let _single = false;
        let _maybeSingle = false;
        let _upsertConflict = null;

        const b = {
            select(str, opts = {}) {
                if (opts.count === 'exact') _countOnly = true;
                if (opts.head) _headOnly = true;
                _selectStr = str || '*';
                return b;
            },
            eq(col, val) {
                _params.push(val);
                _wheres.push(`"${col}" = $${_params.length}`);
                return b;
            },
            neq(col, val) {
                _params.push(val);
                _wheres.push(`"${col}" != $${_params.length}`);
                return b;
            },
            in(col, vals) {
                if (!vals || vals.length === 0) {
                    _wheres.push('FALSE');
                    return b;
                }
                const placeholders = vals.map((v, i) => { _params.push(v); return `$${_params.length}`; });
                _wheres.push(`"${col}" IN (${placeholders.join(', ')})`);
                return b;
            },
            or(orStr) {
                const clause = parseOrFilter(orStr, _params);
                if (clause) _wheres.push(`(${clause})`);
                return b;
            },
            order(col, opts = {}) {
                _orderBy = `"${col}" ${opts.ascending === false ? 'DESC' : 'ASC'}`;
                return b;
            },
            limit(n) {
                _limitN = n;
                return b;
            },
            maybeSingle() { _maybeSingle = true; return b; },
            single() { _single = true; return b; },
            insert(rows) {
                _operation = 'insert';
                _insertRows = Array.isArray(rows) ? rows : [rows];
                return b;
            },
            upsert(rows, opts = {}) {
                _operation = 'upsert';
                _insertRows = Array.isArray(rows) ? rows : [rows];
                _upsertConflict = opts.onConflict || null;
                return b;
            },
            update(data) {
                _operation = 'update';
                _updateData = data;
                return b;
            },
            delete() {
                _operation = 'delete';
                return b;
            },
            // .insert(...).select('col') or .update(...).select()
            select(str, opts = {}) {
                if (_operation === 'insert' || _operation === 'upsert' || _operation === 'update') {
                    _returnSelect = str || '*';
                    return b;
                }
                if (opts.count === 'exact') _countOnly = true;
                if (opts.head) _headOnly = true;
                _selectStr = str || '*';
                return b;
            },
            // Await the builder to execute
            then(resolve, reject) {
                return execute().then(resolve, reject);
            },
        };

        // Redefine select to handle both initial .select() and chained .insert().select()
        let _selectCalled = false;
        const originalSelect = b.select.bind(b);
        b.select = function(str, opts = {}) {
            if (!_selectCalled && _operation === 'select') {
                _selectCalled = true;
                if (opts.count === 'exact') _countOnly = true;
                if (opts.head) _headOnly = true;
                _selectStr = str || '*';
                return b;
            }
            // Chained after insert/update
            _returnSelect = str || '*';
            return b;
        };

        async function execute() {
            try {
                const whereClause = _wheres.length > 0 ? `WHERE ${_wheres.join(' AND ')}` : '';

                if (_operation === 'select') {
                    if (_countOnly) {
                        const sql = `SELECT COUNT(*) as count FROM "${tableName}" ${whereClause}`;
                        const res = await runQuery(sql, _params);
                        const count = parseInt(res.rows[0]?.count || '0', 10);
                        if (_headOnly) return { count, data: null, error: null };
                        return { count, data: null, error: null };
                    }
                    const { cols, joins, colMappings } = parseSelect(tableName, _selectStr);
                    let sql = `SELECT ${cols} FROM "${tableName}" ${joins} ${whereClause}`;
                    if (_orderBy) sql += ` ORDER BY ${_orderBy}`;
                    if (_limitN) sql += ` LIMIT ${_limitN}`;
                    const res = await runQuery(sql, _params);
                    const rows = rehydrate(res.rows, colMappings);
                    if (_single) {
                        if (!rows[0]) return { data: null, error: { message: 'Row not found' } };
                        return { data: rows[0], error: null };
                    }
                    if (_maybeSingle) return { data: rows[0] || null, error: null };
                    return { data: rows, error: null };
                }

                if (_operation === 'insert' || _operation === 'upsert') {
                    if (!_insertRows || _insertRows.length === 0) return { data: [], error: null };
                    const cols = Object.keys(_insertRows[0]);
                    const valueSets = [];
                    const allParams = [];
                    for (const row of _insertRows) {
                        const placeholders = cols.map(c => { allParams.push(row[c] ?? null); return `$${allParams.length}`; });
                        valueSets.push(`(${placeholders.join(', ')})`);
                    }
                    let sql = `INSERT INTO "${tableName}" (${cols.map(c => `"${c}"`).join(', ')}) VALUES ${valueSets.join(', ')}`;
                    if (_operation === 'upsert' && _upsertConflict) {
                        sql += ` ON CONFLICT (${_upsertConflict.split(',').map(c => `"${c.trim()}"`).join(', ')}) DO UPDATE SET `;
                        sql += cols.filter(c => !_upsertConflict.split(',').map(s => s.trim()).includes(c))
                            .map(c => `"${c}" = EXCLUDED."${c}"`).join(', ');
                    } else if (_operation === 'upsert') {
                        sql += ' ON CONFLICT DO NOTHING';
                    }
                    if (_returnSelect) sql += ' RETURNING *';
                    const res = await runQuery(sql, allParams);
                    if (_returnSelect) {
                        if (_single) return { data: res.rows[0] || null, error: null };
                        return { data: res.rows, error: null };
                    }
                    return { data: res.rows, error: null };
                }

                if (_operation === 'update') {
                    if (!_updateData) return { data: null, error: { message: 'No update data' } };
                    const setCols = Object.keys(_updateData);
                    const setParams = [];
                    const setClauses = setCols.map(c => { setParams.push(_updateData[c] ?? null); return `"${c}" = $${setParams.length}`; });
                    const combinedParams = [...setParams, ..._params.map((p, i) => {
                        // remap $N references in _wheres
                        return p;
                    })];
                    // Rebuild wheres with offset
                    const offset = setParams.length;
                    const adjustedWheres = _wheres.map(w => w.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n) + offset}`));
                    const adjustedWhere = adjustedWheres.length > 0 ? `WHERE ${adjustedWheres.join(' AND ')}` : '';
                    let sql = `UPDATE "${tableName}" SET ${setClauses.join(', ')} ${adjustedWhere}`;
                    if (_returnSelect) sql += ' RETURNING *';
                    const res = await runQuery(sql, [...setParams, ..._params]);
                    if (_returnSelect) {
                        if (_single) return { data: res.rows[0] || null, error: null };
                        return { data: res.rows, error: null };
                    }
                    return { data: res.rows, error: null };
                }

                if (_operation === 'delete') {
                    const sql = `DELETE FROM "${tableName}" ${whereClause}`;
                    const res = await runQuery(sql, _params);
                    return { data: res.rows, error: null };
                }
            } catch (err) {
                console.error(`[adapter] Error on "${tableName}":`, err.message);
                return { data: null, error: { message: err.message } };
            }
        }

        return b;
    }

    return {
        from: (tableName) => builder(tableName),
        // auth stub — not used in new flow but keeps any leftover references safe
        auth: {
            admin: {
                getUserById: async () => ({ data: { user: null }, error: null }),
                signOut: async () => ({}),
            },
        },
    };
}

module.exports = { buildAdapter };
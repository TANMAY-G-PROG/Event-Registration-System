require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY in .env');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

// Simple CSV parser — handles quoted fields
function parseCSV(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));

    return lines.slice(1).map(line => {
        const values = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            if (line[i] === '"') {
                inQuotes = !inQuotes;
            } else if (line[i] === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += line[i];
            }
        }
        values.push(current.trim());

        const obj = {};
        headers.forEach((h, i) => {
            obj[h] = values[i] === '' || values[i] === undefined ? null : values[i];
        });
        return obj;
    });
}

const TEMP_PASSWORD = 'FLO@Reset2025!';
const CSV_DIR = path.join(__dirname, 'migration-data');

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function migrateStudents() {
    console.log('\n📦 Step 1: Migrating students and creating auth accounts...');
    const students = parseCSV(path.join(CSV_DIR, 'students.csv'));
    console.log(`   Found ${students.length} students`);

    let success = 0;
    let failed = 0;
    const failedList = [];

    for (let i = 0; i < students.length; i++) {
        const s = students[i];

        if (!s.emailid || !s.usn) {
            console.log(`   ⚠️  Skipping row ${i + 1} — missing email or USN`);
            failed++;
            continue;
        }

        try {
            // Check if student already exists in new DB
            const { data: existing } = await supabaseAdmin
                .from('student')
                .select('usn, auth_id')
                .eq('usn', s.usn)
                .maybeSingle();

            if (existing?.auth_id) {
                console.log(`   ⏭️  ${s.usn} already migrated — skipping`);
                success++;
                continue;
            }

            // Create auth user
            const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
                email: s.emailid,
                password: TEMP_PASSWORD,
                email_confirm: true,
                user_metadata: { usn: s.usn, name: s.sname }
            });

            if (authError) {
                // Email might already exist in auth from a previous partial run
                if (authError.message.includes('already been registered') || authError.message.includes('already exists')) {
                    // Try to find the existing auth user by email
                    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
                    const existingAuthUser = users.find(u => u.email === s.emailid);

                    if (existingAuthUser) {
                        // Link to existing auth user
                        if (existing) {
                            await supabaseAdmin.from('student')
                                .update({ auth_id: existingAuthUser.id })
                                .eq('usn', s.usn);
                        } else {
                            await supabaseAdmin.from('student').insert([{
                                usn: s.usn,
                                sname: s.sname,
                                sem: s.sem ? parseInt(s.sem) : 1,
                                mobno: s.mobno,
                                emailid: s.emailid,
                                auth_id: existingAuthUser.id
                            }]);
                        }
                        console.log(`   ✅ ${s.usn} (${s.emailid}) — linked to existing auth`);
                        success++;
                        continue;
                    }
                }
                console.log(`   ❌ ${s.usn} (${s.emailid}) — auth error: ${authError.message}`);
                failed++;
                failedList.push({ usn: s.usn, email: s.emailid, error: authError.message });
                continue;
            }

            // Insert or update student record
            if (existing) {
                await supabaseAdmin.from('student')
                    .update({ auth_id: authData.user.id })
                    .eq('usn', s.usn);
            } else {
                await supabaseAdmin.from('student').insert([{
                    usn: s.usn,
                    sname: s.sname,
                    sem: s.sem ? parseInt(s.sem) : 1,
                    mobno: s.mobno,
                    emailid: s.emailid,
                    auth_id: authData.user.id
                }]);
            }

            success++;
            if ((i + 1) % 10 === 0) {
                console.log(`   Progress: ${i + 1}/${students.length}`);
            }

            // Small delay to avoid hitting rate limits
            await sleep(200);

        } catch (err) {
            console.log(`   ❌ ${s.usn} — unexpected error: ${err.message}`);
            failed++;
            failedList.push({ usn: s.usn, email: s.emailid, error: err.message });
        }
    }

    console.log(`\n   ✅ Students migrated: ${success}`);
    console.log(`   ❌ Failed: ${failed}`);

    if (failedList.length > 0) {
        fs.writeFileSync(
            path.join(CSV_DIR, 'failed_students.json'),
            JSON.stringify(failedList, null, 2)
        );
        console.log(`   📝 Failed list saved to migration-data/failed_students.json`);
    }

    return success;
}

async function migrateClubs() {
    console.log('\n📦 Step 2: Migrating clubs...');
    const clubs = parseCSV(path.join(CSV_DIR, 'clubs.csv'));
    console.log(`   Found ${clubs.length} clubs`);

    for (const c of clubs) {
        const { error } = await supabaseAdmin.from('club').upsert([{
            cid: parseInt(c.cid),
            cname: c.cname,
            clubdesc: c.clubdesc,
            clubprezusn: c.clubprezusn,
            maxmembers: c.maxmembers ? parseInt(c.maxmembers) : 50
        }], { onConflict: 'cid' });

        if (error) console.log(`   ❌ Club ${c.cid}: ${error.message}`);
    }

    // Reset the sequence so new clubs get correct IDs
    const maxCid = Math.max(...clubs.map(c => parseInt(c.cid)));
    await supabaseAdmin.rpc('set_sequence', { seq_name: 'club_cid_seq', seq_val: maxCid });

    console.log(`   ✅ ${clubs.length} clubs migrated`);
}

async function migrateEvents() {
    console.log('\n📦 Step 3: Migrating events...');
    const events = parseCSV(path.join(CSV_DIR, 'events.csv'));
    console.log(`   Found ${events.length} events`);

    for (const e of events) {
        const { error } = await supabaseAdmin.from('event').upsert([{
            eid: parseInt(e.eid),
            ename: e.ename,
            eventdesc: e.eventdesc,
            eventdate: e.eventdate,
            eventtime: e.eventtime,
            eventloc: e.eventloc,
            maxpart: e.maxpart ? parseInt(e.maxpart) : null,
            maxvoln: e.maxvoln ? parseInt(e.maxvoln) : null,
            orgusn: e.orgusn,
            orgcid: e.orgcid ? parseInt(e.orgcid) : null,
            regfee: e.regfee ? parseFloat(e.regfee) : 0,
            upi_id: e.upi_id,
            is_team: e.is_team === 'true' || e.is_team === 't',
            min_team_size: e.min_team_size ? parseInt(e.min_team_size) : null,
            max_team_size: e.max_team_size ? parseInt(e.max_team_size) : null,
            poster_url: e.poster_url,
            banner_url: e.banner_url,
            activity_points: e.activity_points ? parseInt(e.activity_points) : 0,
            certificate_info: e.certificate_info,
            max_activity_pts: e.max_activity_pts ? parseInt(e.max_activity_pts) : 0,
            vol_activity_pts: e.vol_activity_pts ? parseInt(e.vol_activity_pts) : 0,
            min_part_scans: e.min_part_scans ? parseInt(e.min_part_scans) : 1,
            min_voln_scans: e.min_voln_scans ? parseInt(e.min_voln_scans) : 1
        }], { onConflict: 'eid' });

        if (error) console.log(`   ❌ Event ${e.eid}: ${error.message}`);
    }

    const maxEid = Math.max(...events.map(e => parseInt(e.eid)));
    await supabaseAdmin.rpc('set_sequence', { seq_name: 'event_eid_seq', seq_val: maxEid });

    console.log(`   ✅ ${events.length} events migrated`);
}

async function migrateMemberof() {
    console.log('\n📦 Step 4: Migrating club memberships...');
    const rows = parseCSV(path.join(CSV_DIR, 'memberof.csv'));
    console.log(`   Found ${rows.length} memberships`);

    if (rows.length === 0) { console.log('   ⏭️  Nothing to migrate'); return; }

    const toInsert = rows.map(r => ({
        studentusn: r.studentusn,
        clubid: parseInt(r.clubid)
    }));

    const { error } = await supabaseAdmin.from('memberof').upsert(toInsert);
    if (error) console.log(`   ❌ Memberof error: ${error.message}`);
    else console.log(`   ✅ ${rows.length} memberships migrated`);
}

async function migrateParticipants() {
    console.log('\n📦 Step 5: Migrating participants...');
    const rows = parseCSV(path.join(CSV_DIR, 'participants.csv'));
    console.log(`   Found ${rows.length} participants`);

    if (rows.length === 0) { console.log('   ⏭️  Nothing to migrate'); return; }

    // Insert in batches of 100
    const batchSize = 100;
    let inserted = 0;

    for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize).map(r => ({
            partusn: r.partusn,
            parteid: parseInt(r.parteid),
            partstatus: r.partstatus === 'true' || r.partstatus === 't',
            payment_status: r.payment_status || 'free',
            team_id: r.team_id ? parseInt(r.team_id) : null
        }));

        const { error } = await supabaseAdmin.from('participant').upsert(batch, {
            onConflict: 'partusn,parteid',
            ignoreDuplicates: true
        });
        if (error) console.log(`   ❌ Participant batch error: ${error.message}`);
        else inserted += batch.length;
    }

    console.log(`   ✅ ${inserted} participants migrated`);
}

async function migrateVolunteers() {
    console.log('\n📦 Step 6: Migrating volunteers...');
    const rows = parseCSV(path.join(CSV_DIR, 'volunteers.csv'));
    console.log(`   Found ${rows.length} volunteers`);

    if (rows.length === 0) { console.log('   ⏭️  Nothing to migrate'); return; }

    const batchSize = 100;
    let inserted = 0;

    for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize).map(r => ({
            volnusn: r.volnusn,
            volneid: parseInt(r.volneid),
            volnstatus: r.volnstatus === 'true' || r.volnstatus === 't'
        }));

        const { error } = await supabaseAdmin.from('volunteer').upsert(batch, {
            onConflict: 'volnusn,volneid',
            ignoreDuplicates: true
        });
        if (error) console.log(`   ❌ Volunteer batch error: ${error.message}`);
        else inserted += batch.length;
    }

    console.log(`   ✅ ${inserted} volunteers migrated`);
}

async function migrateSubEvents() {
    console.log('\n📦 Step 7: Migrating sub-events...');
    const rows = parseCSV(path.join(CSV_DIR, 'subevents.csv'));
    console.log(`   Found ${rows.length} sub-events`);

    if (rows.length === 0) { console.log('   ⏭️  Nothing to migrate'); return; }

    for (const r of rows) {
        const { error } = await supabaseAdmin.from('sub_event').upsert([{
            seid: parseInt(r.seid),
            eid: parseInt(r.eid),
            se_name: r.se_name,
            se_details: r.se_details || '',
            activity_pts: r.activity_pts ? parseInt(r.activity_pts) : 0,
            created_at: r.created_at || new Date().toISOString()
        }], { onConflict: 'seid' });

        if (error) console.log(`   ❌ Sub-event ${r.seid}: ${error.message}`);
    }

    const maxSeid = Math.max(...rows.map(r => parseInt(r.seid)));
    await supabaseAdmin.rpc('set_sequence', { seq_name: 'sub_event_seid_seq', seq_val: maxSeid });

    console.log(`   ✅ ${rows.length} sub-events migrated`);
}

async function migrateSubEventAttendance() {
    console.log('\n📦 Step 8: Migrating sub-event attendance...');
    const rows = parseCSV(path.join(CSV_DIR, 'subevents_attendance.csv'));
    console.log(`   Found ${rows.length} attendance records`);

    if (rows.length === 0) { console.log('   ⏭️  Nothing to migrate'); return; }

    const batchSize = 100;
    let inserted = 0;

    for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize).map(r => ({
            seid: parseInt(r.seid),
            eid: parseInt(r.eid),
            usn: r.usn,
            role: r.role,
            scanned_at: r.scanned_at || new Date().toISOString()
        }));

        const { error } = await supabaseAdmin.from('sub_event_attendance').upsert(batch, {
            onConflict: 'seid,usn,role'
        });
        if (error) console.log(`   ❌ Attendance batch error: ${error.message}`);
        else inserted += batch.length;
    }

    console.log(`   ✅ ${inserted} attendance records migrated`);
}

async function migratePayments() {
    console.log('\n📦 Step 9: Migrating payments...');
    const rows = parseCSV(path.join(CSV_DIR, 'payments.csv'));
    console.log(`   Found ${rows.length} payment records`);

    if (rows.length === 0) { console.log('   ⏭️  Nothing to migrate'); return; }

    const batchSize = 100;
    let inserted = 0;

    for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize).map(r => ({
            usn: r.usn,
            event_id: parseInt(r.event_id),
            amount: r.amount ? parseFloat(r.amount) : 0,
            status: r.status || 'pending_verification',
            upi_transaction_id: r.upi_transaction_id,
            created_at: r.created_at || new Date().toISOString()
        }));

        const { error } = await supabaseAdmin.from('payment').upsert(batch);
        if (error) console.log(`   ❌ Payment batch error: ${error.message}`);
        else inserted += batch.length;
    }

    console.log(`   ✅ ${inserted} payment records migrated`);
}

async function createSequenceHelper() {
    console.log('\n⚙️  Verifying sequence helper function...');
    // Just verify by calling it with a safe test — club sequence exists for sure
    const { error } = await supabaseAdmin.rpc('set_sequence', {
        seq_name: 'club_cid_seq',
        seq_val: 1
    });

    if (error) {
        console.log('   ⚠️  Sequence helper not found. Please run this in your Supabase SQL Editor:');
        console.log(`
CREATE OR REPLACE FUNCTION set_sequence(seq_name TEXT, seq_val BIGINT)
RETURNS void AS $$
BEGIN
  EXECUTE format('SELECT setval(%L, %L)', seq_name, seq_val);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
    `);
        console.log('   Then re-run this script.');
        process.exit(1);
    }

    console.log('   ✅ Sequence helper verified');
}

async function runMigration() {
    console.log('🚀 Starting data migration to new Supabase project...');
    console.log(`   URL: ${supabaseUrl}`);
    console.log(`   Temp password for all migrated users: ${TEMP_PASSWORD}`);
    console.log('   ⚠️  Users will need to change this password on first login\n');

    // Check migration data folder exists
    if (!fs.existsSync(CSV_DIR)) {
        console.error(`❌ Migration data folder not found at: ${CSV_DIR}`);
        console.error('   Create the folder backend/scripts/migration-data and put all CSV files there');
        process.exit(1);
    }

    await createSequenceHelper();
    await migrateStudents();
    await migrateClubs();
    await migrateEvents();
    await migrateMemberof();
    await migrateParticipants();
    await migrateVolunteers();
    await migrateSubEvents();
    await migrateSubEventAttendance();
    await migratePayments();

    console.log('\n✅ Migration complete!');
    console.log('\n📋 Next steps:');
    console.log('   1. Check migration-data/failed_students.json if it was created');
    console.log('   2. Run the verification queries in Supabase SQL Editor');
    console.log(`   3. Inform existing users their temporary password is: ${TEMP_PASSWORD}`);
    console.log('   4. They should sign in and change password from Profile page immediately');
}

runMigration().catch(err => {
    console.error('💥 Migration failed:', err);
    process.exit(1);
});
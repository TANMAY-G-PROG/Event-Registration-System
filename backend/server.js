require('dotenv').config();
const express = require('express');
const path = require('path');
const supabase = require('./lib/supabase');
const session = require('express-session');
const bcrypt = require('bcrypt');
const cors = require('cors');
const crypto = require('crypto');
const ExcelJS = require('exceljs');
const { createClient } = require('redis');
const RedisStore = require('connect-redis').RedisStore;
const Brevo = require('@getbrevo/brevo');
const QR_TOKEN_SECRET = process.env.QR_TOKEN_SECRET || 'your-qr-secret-change-in-production';
const QR_TOKEN_VALIDITY_MS = 18000; // 15s display + 3s grace

// --- File Upload Dependencies ---
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const streamifier = require('streamifier');

// --- Cloudinary Config ---
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// --- Multer Config (Efficient for 512MB RAM) ---
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// --- Brevo Configuration ---
const apiInstance = new Brevo.TransactionalEmailsApi();
const apiKey = apiInstance.authentications['apiKey'];
apiKey.apiKey = process.env.BREVO_API_KEY;

const app = express();
const PORT = process.env.PORT || 3000;

// --- PRODUCTION/DEVELOPMENT SETTINGS ---
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// --- Redis Client Setup ---
const redisUrl = process.env.REDIS_URL || 'redis://default:ovBfSh1ALdigQLS0BDbJApUwTOJ6nk3i@redis-10269.c81.us-east-1-2.ec2.cloud.redislabs.com:10269';

const redisClient = createClient({
    url: redisUrl
});

redisClient.on('error', (err) => console.log('❌ Redis Client Error', err));
redisClient.on('connect', () => console.log('✅ Connected to Redis Cloud'));

(async () => {
    try {
        await redisClient.connect();
    } catch (err) {
        console.error('Failed to connect to Redis:', err);
    }
})();

if (IS_PRODUCTION) {
    app.set('trust proxy', 1);
}

app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['set-cookie']
}));

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Credentials", "true");
    next();
});

app.use(express.json());

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

app.use(session({
    store: new RedisStore({
        client: redisClient,
        prefix: 'sess:',
        ttl: 3600,
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    name: 'sessionId',
    rolling: true,
    cookie: {
        httpOnly: true,
        maxAge: 60 * 60 * 1000,
        secure: IS_PRODUCTION ? true : false,
        sameSite: IS_PRODUCTION ? "lax" : "lax",
        path: '/'
    }
}));

app.use((req, res, next) => {
    console.log(`\n📝 ${req.method} ${req.url}`);
    next();
});

async function testSupabaseConnection() {
    try {
        const { data, error } = await supabase.from('student').select('count').limit(1);
        if (error) throw error;
        console.log('✅ Supabase connected successfully');
    } catch (err) {
        console.error('❌ Supabase connection failed:', err);
    }
}
testSupabaseConnection();

function requireAuth(req, res, next) {
    if (req.session.userUSN) {
        next();
    } else {
        console.log('❌ User NOT authenticated - sending 401');
        res.status(401).json({ error: 'Please sign in first' });
    }
}

const uploadFromBuffer = (buffer) => {
    return new Promise((resolve, reject) => {
        const cld_upload_stream = cloudinary.uploader.upload_stream(
            { folder: "event_banners" },
            (error, result) => {
                if (result) resolve(result);
                else reject(error);
            }
        );
        streamifier.createReadStream(buffer).pipe(cld_upload_stream);
    });
};

// Sign up endpoint
app.post('/api/signup', async (req, res) => {
    try {
        const { name, usn, sem, mobno, email, password } = req.body;

        if (!usn || !name || !email || !sem || !mobno || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const { data: existingUser, error: checkError } = await supabase
            .from('student')
            .select('usn')
            .or(`usn.eq.${usn},emailid.eq.${email}`)
            .limit(1);

        if (checkError) {
            console.error('Error checking existing user:', checkError);
            return res.status(500).json({ error: 'Database error' });
        }

        if (existingUser && existingUser.length > 0) {
            return res.status(400).json({ error: 'Student with this USN or email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const { data, error } = await supabase
            .from('student')
            .insert([{
                usn: usn,
                sname: name,
                sem: sem,
                mobno: mobno,
                emailid: email,
                password: hashedPassword
            }])
            .select();

        if (error) {
            console.error('Error inserting student:', error);
            return res.status(500).json({ error: `Error registering student: ${error.message}` });
        }

        req.session.userUSN = usn;
        req.session.userName = name;
        req.session.userEmail = email;

        req.session.save((err) => {
            if (err) {
                console.error('❌ Session save error:', err);
                return res.status(500).json({ error: 'Session error' });
            }
            res.status(201).json({
                success: true,
                message: 'Student registered successfully!',
                userUSN: usn,
                userName: name
            });
        });
    } catch (err) {
        console.error('Error registering student:', err);
        res.status(500).json({ error: `Error registering student: ${err.message}` });
    }
});

// Sign in endpoint
app.post('/api/signin', async (req, res) => {
    try {
        const { usn, password } = req.body;

        if (!usn || !password) {
            return res.status(400).json({ error: 'USN and password are required' });
        }

        const { data: rows, error } = await supabase
            .from('student')
            .select('usn, sname, emailid, password')
            .eq('usn', usn)
            .limit(1);

        if (error) {
            console.error('Error fetching student:', error);
            return res.status(500).json({ error: 'Database error' });
        }

        if (!rows || rows.length === 0) {
            return res.status(401).json({ error: 'Invalid USN or password' });
        }

        const student = rows[0];

        const validPassword = await bcrypt.compare(password, student.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid USN or password' });
        }

        req.session.userUSN = student.usn;
        req.session.userName = student.sname;
        req.session.userEmail = student.emailid;

        req.session.save((err) => {
            if (err) {
                console.error('❌ Session save error:', err);
                return res.status(500).json({ error: 'Session error' });
            }
            console.log('✅ User signed in:', student.usn);
            res.json({
                success: true,
                message: 'Signed in successfully',
                userUSN: student.usn,
                userName: student.sname
            });
        });
    } catch (err) {
        console.error('Error signing in:', err);
        res.status(500).json({ error: `Error signing in: ${err.message}` });
    }
});

app.get('/api/me', requireAuth, async (req, res) => {
    try {
        const { data: rows, error } = await supabase
            .from('student')
            .select('usn, sname, sem, mobno, emailid')
            .eq('usn', req.session.userUSN)
            .limit(1);

        if (error) {
            console.error('Error fetching user info:', error);
            return res.status(500).json({ error: 'Database error' });
        }

        if (!rows || rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const student = rows[0];
        res.json({
            userUSN: student.usn,
            userName: student.sname,
            semester: student.sem,
            mobile: student.mobno,
            email: student.emailid
        });
    } catch (err) {
        console.error('Error fetching user info:', err);
        res.status(500).json({ error: 'Error fetching user info' });
    }
});

app.post('/api/signout', (req, res) => {
    const userUSN = req.session.userUSN;
    req.session.destroy((err) => {
        if (err) {
            console.error('❌ Session destroy error:', err);
            return res.status(500).json({ error: 'Could not sign out' });
        }
        console.log('✅ User signed out:', userUSN);
        res.json({ success: true, message: 'Signed out successfully' });
    });
});

// --- CACHED Get all events ---
app.get('/api/events', requireAuth, async (req, res) => {
    try {
        const currentDate = new Date().toISOString().split('T')[0];
        const cacheKey = 'events_list_raw';
        let rows = null;

        try {
            if (redisClient.isOpen) {
                const cachedData = await redisClient.get(cacheKey);
                if (cachedData) rows = JSON.parse(cachedData);
            }
        } catch (cacheErr) { console.error('Redis error:', cacheErr); }

        if (!rows) {
            const { data, error } = await supabase
                .from('event')
                .select(`
                    eid, ename, eventdesc, eventdate, eventtime, eventloc, maxpart, maxvoln, regfee,
                    upi_id, is_team, min_team_size, max_team_size, poster_url, banner_url, activity_points,
                    max_activity_pts, vol_activity_pts, min_part_scans, min_voln_scans,
                    club:orgcid(cname),
                    student:orgusn(sname)
                `);

            if (error) throw error;
            rows = data;

            try {
                if (redisClient.isOpen) await redisClient.set(cacheKey, JSON.stringify(rows), { EX: 600 });
            } catch (saveErr) { console.error('Redis write error:', saveErr); }
        }

        const events = { ongoing: [], completed: [], upcoming: [] };

        (rows || []).forEach(event => {
            const transformedEvent = {
                ...event,
                eventDate: event.eventdate,
                eventTime: event.eventtime,
                eventLoc: event.eventloc,
                maxPart: event.maxpart,
                maxVoln: event.maxvoln,
                regFee: event.regfee,
                upiId: event.upi_id,
                posterUrl: event.poster_url,
                bannerUrl: event.banner_url,
                is_team: event.is_team,
                min_team_size: event.min_team_size,
                max_team_size: event.max_team_size,
                activityPoints: event.activity_points || 0,
                maxActivityPts: event.max_activity_pts || 0,
                volActivityPts: event.vol_activity_pts || 0,
                clubName: event.club?.cname,
                organizerName: event.student?.sname
            };

            const eventDate = new Date(event.eventdate).toISOString().split('T')[0];
            if (eventDate === currentDate) events.ongoing.push(transformedEvent);
            else if (eventDate < currentDate) events.completed.push(transformedEvent);
            else events.upcoming.push(transformedEvent);
        });

        res.json({ events, currentUser: req.session.userUSN });
    } catch (err) {
        console.error('Error fetching events:', err);
        res.status(500).json({ error: 'Error fetching events' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// Get user's participant events
// activity_points per event included — NO cumulative total
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/my-participant-events', requireAuth, async (req, res) => {
    try {
        const { data: participantEvents, error } = await supabase
            .from('participant')
            .select(`
                partstatus, partusn, parteid,
                event:parteid (
                    eid, ename, eventdesc, certificate_info, eventdate, eventtime, eventloc,
                    maxpart, maxvoln, regfee, poster_url, activity_points,
                    max_activity_pts,
                    club:orgcid(cname)
                )
            `)
            .eq('partusn', req.session.userUSN);

        if (error) {
            console.error('Error fetching participant events:', error);
            return res.status(500).json({ error: 'Database error' });
        }

        const userUSN = req.session.userUSN;
        const transformedEvents = [];

        for (const p of (participantEvents || [])) {
            const event = p.event;
            if (!event?.eid) continue;

            let earnedActivityPts = 0;
            const maxActivityPts = event.max_activity_pts || 0;

            if (maxActivityPts > 0 && p.partstatus) {
                const { data: attendanceData } = await supabase
                    .from('sub_event_attendance')
                    .select('seid, sub_event!inner(activity_pts)')
                    .eq('eid', event.eid)
                    .eq('usn', userUSN)
                    .eq('role', 'participant');

                if (attendanceData && attendanceData.length > 0) {
                    const sumOfScannedPts = attendanceData.reduce((sum, row) => {
                        return sum + (row.sub_event?.activity_pts || 0);
                    }, 0);
                    earnedActivityPts = Math.min(sumOfScannedPts, maxActivityPts);
                }
            }

            transformedEvents.push({
                ...event,
                eventDate: event.eventdate,
                eventTime: event.eventtime,
                eventLoc: event.eventloc,
                maxPart: event.maxpart,
                maxVoln: event.maxvoln,
                regFee: event.regfee,
                posterUrl: event.poster_url,
                activityPoints: event.activity_points || 0,
                maxActivityPts: maxActivityPts,
                earnedActivityPts: earnedActivityPts,
                clubName: event.club?.cname,
                PartStatus: p.partstatus == true,
                PartUSN: p.partusn,
                role: 'participant'
            });
        }

        res.json({
            participantEvents: transformedEvents,
            userUSN: req.session.userUSN
        });
    } catch (err) {
        console.error('Error fetching participant events:', err);
        res.status(500).json({ error: 'Error fetching participant events' });
    }
});

app.get('/api/my-volunteer-events', requireAuth, async (req, res) => {
    try {
        const { data: volunteerEvents, error } = await supabase
            .from('volunteer')
            .select(`
                volnstatus, volnusn, volneid,
                event:volneid (
                    eid, ename, eventdesc, eventdate, eventtime, eventloc, maxpart, maxvoln, regfee,
                    vol_activity_pts,
                    club:orgcid(cname)
                )
            `)
            .eq('volnusn', req.session.userUSN);

        if (error) {
            console.error('Error fetching volunteer events:', error);
            return res.status(500).json({ error: 'Database error' });
        }

        const transformedEvents = (volunteerEvents || []).map(v => {
            const volActivityPts = v.event?.vol_activity_pts || 0;
            const earnedActivityPts = v.volnstatus ? volActivityPts : 0;

            return {
                ...v.event,
                eventDate: v.event?.eventdate,
                eventTime: v.event?.eventtime,
                eventLoc: v.event?.eventloc,
                maxPart: v.event?.maxpart,
                maxVoln: v.event?.maxvoln,
                regFee: v.event?.regfee,
                volActivityPts: volActivityPts,
                earnedActivityPts: earnedActivityPts,
                clubName: v.event?.club?.cname,
                VolnStatus: v.volnstatus == true,
                role: 'volunteer'
            };
        }).filter(e => e.eid);

        res.json({
            volunteerEvents: transformedEvents,
            userUSN: req.session.userUSN
        });
    } catch (err) {
        console.error('Error fetching volunteer events:', err);
        res.status(500).json({ error: 'Error fetching volunteer events' });
    }
});

app.get('/api/my-organized-events', requireAuth, async (req, res) => {
    try {
        const { data: organizerEvents, error } = await supabase
            .from('event')
            .select(`
                eid, ename, eventdesc, eventdate, eventtime, eventloc, maxpart, maxvoln, regfee,
                upi_id, poster_url, activity_points,
                club:orgcid(cname)
            `)
            .eq('orgusn', req.session.userUSN);

        if (error) {
            console.error('Error fetching organized events:', error);
            return res.status(500).json({ error: 'Database error' });
        }

        const transformedEvents = (organizerEvents || []).map(e => ({
            ...e,
            eventDate: e.eventdate,
            eventTime: e.eventtime,
            eventLoc: e.eventloc,
            maxPart: e.maxpart,
            maxVoln: e.maxvoln,
            regFee: e.regfee,
            upiId: e.upi_id,
            posterUrl: e.poster_url,
            activityPoints: e.activity_points || 0,
            clubName: e.club?.cname,
            role: 'organizer'
        }));

        res.json({
            organizerEvents: transformedEvents,
            userUSN: req.session.userUSN
        });
    } catch (err) {
        console.error('Error fetching organized events:', err);
        res.status(500).json({ error: 'Error fetching organized events' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// Create/Organize a new event — saves activity_points
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/events/create', requireAuth, upload.single('banner'), async (req, res) => {
    try {
        const {
            eventName,
            eventDescription,
            certificate_info,
            posterUrl,
            eventDate,
            eventTime,
            eventLocation,
            maxParticipants,
            maxVolunteers,
            registrationFee,
            clubId,
            OrgCid,
            upiId,
            isTeamEvent,
            minTeamSize,
            maxTeamSize,
            activityPoints,
            maxActivityPts,
            volActivityPts,
            minPartScans,
            minVolnScans
        } = req.body;

        const file = req.file;
        let finalBannerUrl = null;

        if (file) {
            try {
                console.log('📤 Streaming banner to Cloudinary...');
                const result = await uploadFromBuffer(file.buffer);
                finalBannerUrl = result.secure_url;
                console.log('✅ Banner upload success:', finalBannerUrl);
            } catch (uploadErr) {
                console.error('Cloudinary Upload Error:', uploadErr);
                return res.status(500).json({ error: 'Failed to upload banner image' });
            }
        }

        const organizedClubId = (clubId || OrgCid) ? parseInt(clubId || OrgCid) : null;
        const fee = parseFloat(registrationFee) || 0;
        const isTeam = isTeamEvent === 'true' || isTeamEvent === true;
        const points = parseInt(activityPoints) || 0;

        if (organizedClubId) {
            const { data: membershipCheck, error: memberError } = await supabase
                .from('memberof')
                .select('clubid')
                .eq('studentusn', req.session.userUSN)
                .eq('clubid', organizedClubId)
                .limit(1);

            if (memberError) {
                console.error('Membership check failed:', memberError);
                return res.status(500).json({ error: 'Database verification failed' });
            }

            if (!membershipCheck || membershipCheck.length === 0) {
                return res.status(403).json({
                    error: 'Unauthorized: You are not a member of this club and cannot organize events for it.'
                });
            }
        }

        if (!eventName || !eventDescription || !eventDate || !eventTime || !eventLocation) {
            return res.status(400).json({ error: 'Required fields missing' });
        }

        if (fee > 0 && (!upiId || upiId.trim() === '')) {
            return res.status(400).json({ error: 'UPI ID is required for paid events' });
        }

        const eventData = {
            ename: eventName,
            eventdesc: eventDescription,
            certificate_info: certificate_info || null,
            poster_url: posterUrl || null,
            banner_url: finalBannerUrl,
            eventdate: eventDate,
            eventtime: eventTime,
            eventloc: eventLocation,
            maxpart: maxParticipants ? parseInt(maxParticipants) : null,
            maxvoln: maxVolunteers ? parseInt(maxVolunteers) : null,
            regfee: fee,
            upi_id: fee > 0 ? upiId : null,
            orgusn: req.session.userUSN,
            orgcid: organizedClubId || null,
            is_team: isTeam,
            min_team_size: isTeam ? (parseInt(minTeamSize) || null) : null,
            max_team_size: isTeam ? (parseInt(maxTeamSize) || null) : null,
            activity_points: points,
            max_activity_pts: parseInt(maxActivityPts) || 0,
            vol_activity_pts: parseInt(volActivityPts) || 0,
            min_part_scans: parseInt(minPartScans) || 1,
            min_voln_scans: parseInt(minVolnScans) || 1
        };

        const { data, error } = await supabase
            .from('event')
            .insert([eventData])
            .select('eid');

        if (error) throw error;

        const newEventId = data[0]?.eid;

        const { error: subEventError } = await supabase
            .from('sub_event')
            .insert([{
                eid: newEventId,
                se_name: eventName,
                se_details: '',
                activity_pts: parseInt(maxActivityPts) || 0
            }]);

        if (subEventError) {
            console.error('Error creating default sub-event:', subEventError);
        }

        if (redisClient.isOpen) await redisClient.del('events_list_raw');

        res.status(201).json({
            success: true,
            message: 'Event created successfully!',
            eventId: newEventId
        });

    } catch (err) {
        console.error('Error creating event:', err);
        res.status(500).json({ error: `Error creating event: ${err.message}` });
    }
});

// Join event as participant (ONLY FOR FREE EVENTS)
app.post('/api/events/:eventId/join', requireAuth, async (req, res) => {
    try {
        const eventId = req.params.eventId;
        const userUSN = req.session.userUSN;

        const { data: existing, error: existingError } = await supabase
            .from('participant')
            .select('*')
            .eq('partusn', userUSN)
            .eq('parteid', eventId)
            .limit(1);

        if (existingError) {
            console.error('Error checking existing participation:', existingError);
            return res.status(500).json({ error: 'Database error' });
        }

        if (existing && existing.length > 0) {
            return res.status(400).json({ error: 'Already joined this event' });
        }

        const { data: event, error: eventError } = await supabase
            .from('event')
            .select('maxpart, regfee')
            .eq('eid', eventId)
            .limit(1);

        if (eventError) {
            console.error('Error fetching event:', eventError);
            return res.status(500).json({ error: 'Database error' });
        }

        if (!event || event.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }

        const regFee = event[0].regfee || 0;

        if (regFee > 0) {
            return res.status(400).json({
                error: 'This is a paid event. Please use the UPI payment flow.',
                requiresPayment: true
            });
        }

        const maxPart = event[0].maxpart || 0;
        if (maxPart > 0) {
            const { count, error: countError } = await supabase
                .from('participant')
                .select('*', { count: 'exact', head: true })
                .eq('parteid', eventId);

            if (countError) {
                console.error('Error counting participants:', countError);
                return res.status(500).json({ error: 'Database error' });
            }

            if (count >= maxPart) {
                return res.status(400).json({ error: 'No more participant slots available' });
            }
        }

        const { error: insertError } = await supabase
            .from('participant')
            .insert([{
                partusn: userUSN,
                parteid: eventId,
                partstatus: false,
                payment_status: 'free'
            }]);

        if (insertError) {
            console.error('Error joining event:', insertError);
            return res.status(500).json({ error: 'Database error' });
        }

        res.json({ success: true, message: 'Successfully joined event!', userUSN: userUSN });
    } catch (err) {
        console.error('Error joining event:', err);
        res.status(500).json({ error: 'Error joining event' });
    }
});

// Volunteer for event
app.post('/api/events/:eventId/volunteer', requireAuth, async (req, res) => {
    try {
        const eventId = req.params.eventId;
        const userUSN = req.session.userUSN;

        const { data: existing, error: existingError } = await supabase
            .from('volunteer')
            .select('*')
            .eq('volnusn', userUSN)
            .eq('volneid', eventId)
            .limit(1);

        if (existingError) {
            console.error('Error checking existing volunteer:', existingError);
            return res.status(500).json({ error: 'Database error' });
        }

        if (existing && existing.length > 0) {
            return res.status(400).json({ error: 'Already volunteered for this event' });
        }

        const { data: event, error: eventError } = await supabase
            .from('event')
            .select('maxvoln')
            .eq('eid', eventId)
            .limit(1);

        if (eventError) {
            console.error('Error fetching event:', eventError);
            return res.status(500).json({ error: 'Database error' });
        }

        if (!event || event.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }

        const maxVoln = event[0].maxvoln || 0;
        if (maxVoln > 0) {
            const { count, error: countError } = await supabase
                .from('volunteer')
                .select('*', { count: 'exact', head: true })
                .eq('volneid', eventId);

            if (countError) {
                console.error('Error counting volunteers:', countError);
                return res.status(500).json({ error: 'Database error' });
            }

            if (count >= maxVoln) {
                return res.status(400).json({ error: 'No more volunteer slots available' });
            }
        }

        const { error: insertError } = await supabase
            .from('volunteer')
            .insert([{
                volnusn: userUSN,
                volneid: eventId,
                volnstatus: false
            }]);

        if (insertError) {
            console.error('Error volunteering for event:', insertError);
            return res.status(500).json({ error: 'Database error' });
        }

        res.json({ success: true, message: 'Successfully volunteered for event!' });
    } catch (err) {
        console.error('Error volunteering for event:', err);
        res.status(500).json({ error: 'Error volunteering for event' });
    }
});

app.get('/api/events/:eventId/volunteer-count', requireAuth, async (req, res) => {
    try {
        const eventId = req.params.eventId;
        const { count, error } = await supabase
            .from('volunteer')
            .select('*', { count: 'exact', head: true })
            .eq('volneid', eventId);

        if (error) {
            console.error('Error fetching volunteer count:', error);
            return res.status(500).json({ error: 'Database error' });
        }

        res.json({ count: count || 0 });
    } catch (err) {
        console.error('Error fetching volunteer count:', err);
        res.status(500).json({ error: 'Error fetching volunteer count' });
    }
});

app.get('/api/events/:eventId/participant-count', requireAuth, async (req, res) => {
    try {
        const eventId = req.params.eventId;
        const { count, error } = await supabase
            .from('participant')
            .select('*', { count: 'exact', head: true })
            .eq('parteid', eventId);

        if (error) {
            console.error('Error fetching participant count:', error);
            return res.status(500).json({ error: 'Database error' });
        }

        res.json({ count: count || 0 });
    } catch (err) {
        console.error('Error fetching participant count:', err);
        res.status(500).json({ error: 'Error fetching participant count' });
    }
});

app.get('/api/events/:eventId/participant-status', requireAuth, async (req, res) => {
    try {
        const eventId = req.params.eventId;
        const userUSN = req.session.userUSN;

        const { data: event, error: eventError } = await supabase
            .from('event')
            .select(`
                eid, ename, eventdesc, eventdate, eventtime, eventloc, maxpart, regfee,
                club:orgcid(cname)
            `)
            .eq('eid', eventId)
            .limit(1)
            .maybeSingle();

        if (eventError) {
            console.error('Error fetching event for ticket:', eventError);
            return res.status(500).json({ error: 'Database error' });
        }

        if (!event) return res.status(404).json({ error: 'Event not found' });

        const { data: participant, error: partError } = await supabase
            .from('participant')
            .select('partstatus, payment_status')
            .eq('parteid', eventId)
            .eq('partusn', userUSN)
            .maybeSingle();

        if (partError) {
            console.error('Error checking participant status:', partError);
            return res.status(500).json({ error: 'Database error' });
        }

        if (!participant) {
            return res.json({
                isRegistered: false,
                ename: event.ename
            });
        }

        res.json({
            isRegistered: true,
            ename: event.ename,
            clubName: event.club?.cname,
            eventDate: event.eventdate,
            eventTime: event.eventtime,
            eventLoc: event.eventloc,
            eventdesc: event.eventdesc,
            regFee: event.regfee,
            maxPart: event.maxpart,
            paymentStatus: participant.payment_status || (event.regfee > 0 ? 'pending' : 'verified')
        });

    } catch (err) {
        console.error('Error in participant-status route:', err);
        res.status(500).json({ error: 'Server Error' });
    }
});

app.get('/api/events/:eventId/sub-events', requireAuth, async (req, res) => {
    try {
        const eventId = req.params.eventId;

        const { data: subEvents, error } = await supabase
            .from('sub_event')
            .select('*')
            .eq('eid', eventId)
            .order('seid', { ascending: true })
            .order('seid', { ascending: true });

        if (error) {
            console.error('Error fetching sub-events:', error);
            return res.status(500).json({ error: 'Database error' });
        }

        const subEventsWithCount = await Promise.all((subEvents || []).map(async (se) => {
            const { count } = await supabase
                .from('sub_event_attendance')
                .select('*', { count: 'exact', head: true })
                .eq('seid', se.seid);

            return {
                ...se,
                attendanceCount: count || 0
            };
        }));

        res.json({ subEvents: subEventsWithCount });
    } catch (err) {
        console.error('Error fetching sub-events:', err);
        res.status(500).json({ error: 'Error fetching sub-events' });
    }
});

app.post('/api/events/:eventId/sub-events', requireAuth, async (req, res) => {
    try {
        const eventId = req.params.eventId;
        const { se_name, activity_pts, se_details } = req.body;

        if (!se_name) {
            return res.status(400).json({ error: 'Sub-event name is required' });
        }

        if (activity_pts !== undefined && activity_pts < 0) {
            return res.status(400).json({ error: 'Activity points cannot be negative' });
        }

        const { data: event, error: eventError } = await supabase
            .from('event')
            .select('orgusn')
            .eq('eid', eventId)
            .limit(1);

        if (eventError || !event?.length) {
            return res.status(404).json({ error: 'Event not found' });
        }

        if (event[0].orgusn !== req.session.userUSN) {
            return res.status(403).json({ error: 'Only the organizer can add sub-events' });
        }

        const { data: newSubEvent, error: insertError } = await supabase
            .from('sub_event')
            .insert([{
                eid: eventId,
                se_name: se_name,
                se_details: se_details || '',
                activity_pts: parseInt(activity_pts) || 0
            }])
            .select()
            .single();

        if (insertError) {
            console.error('Error creating sub-event:', insertError);
            return res.status(500).json({ error: 'Failed to create sub-event' });
        }

        res.status(201).json(newSubEvent);
    } catch (err) {
        console.error('Error creating sub-event:', err);
        res.status(500).json({ error: 'Error creating sub-event' });
    }
});

app.put('/api/sub-events/:seid', requireAuth, async (req, res) => {
    try {
        const seid = req.params.seid;
        const { se_name, activity_pts, se_details, password } = req.body;

        if (!password) {
            return res.status(400).json({ error: 'Password is required to confirm changes' });
        }

        if (activity_pts !== undefined && activity_pts < 0) {
            return res.status(400).json({ error: 'Activity points cannot be negative' });
        }

        // Verify password
        const { data: userData, error: userError } = await supabase
            .from('student')
            .select('password')
            .eq('usn', req.session.userUSN)
            .single();

        if (userError || !userData) {
            return res.status(401).json({ error: 'User verification failed' });
        }

        const isValid = await bcrypt.compare(password, userData.password);
        if (!isValid) {
            return res.status(401).json({ error: 'Incorrect password' });
        }

        const { data: subEvent, error: fetchError } = await supabase
            .from('sub_event')
            .select('eid')
            .eq('seid', seid)
            .limit(1);

        if (fetchError || !subEvent?.length) {
            return res.status(404).json({ error: 'Sub-event not found' });
        }

        const { data: event, error: eventError } = await supabase
            .from('event')
            .select('orgusn')
            .eq('eid', subEvent[0].eid)
            .limit(1);

        if (eventError || !event?.length) {
            return res.status(404).json({ error: 'Event not found' });
        }

        if (event[0].orgusn !== req.session.userUSN) {
            return res.status(403).json({ error: 'Only the organizer can update sub-events' });
        }

        const updateData = {};
        if (se_name !== undefined) updateData.se_name = se_name;
        if (activity_pts !== undefined) updateData.activity_pts = parseInt(activity_pts) || 0;
        if (se_details !== undefined) updateData.se_details = se_details || '';

        const { data: updatedSubEvent, error: updateError } = await supabase
            .from('sub_event')
            .update(updateData)
            .eq('seid', seid)
            .select()
            .single();

        if (updateError) {
            console.error('Error updating sub-event:', updateError);
            return res.status(500).json({ error: 'Failed to update sub-event' });
        }

        res.json(updatedSubEvent);
    } catch (err) {
        console.error('Error updating sub-event:', err);
        res.status(500).json({ error: 'Error updating sub-event' });
    }
});

app.delete('/api/sub-events/:seid', requireAuth, async (req, res) => {
    try {
        const seid = req.params.seid;
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({ error: 'Password is required to confirm deletion' });
        }

        // Verify password
        const { data: userData, error: userError } = await supabase
            .from('student')
            .select('password')
            .eq('usn', req.session.userUSN)
            .single();

        if (userError || !userData) {
            return res.status(401).json({ error: 'User verification failed' });
        }

        const isValid = await bcrypt.compare(password, userData.password);
        if (!isValid) {
            return res.status(401).json({ error: 'Incorrect password' });
        }

        const { data: subEvent, error: fetchError } = await supabase
            .from('sub_event')
            .select('eid')
            .eq('seid', seid)
            .limit(1);

        if (fetchError || !subEvent?.length) {
            return res.status(404).json({ error: 'Sub-event not found' });
        }

        const { data: event, error: eventError } = await supabase
            .from('event')
            .select('orgusn')
            .eq('eid', subEvent[0].eid)
            .limit(1);

        if (eventError || !event?.length) {
            return res.status(404).json({ error: 'Event not found' });
        }

        if (event[0].orgusn !== req.session.userUSN) {
            return res.status(403).json({ error: 'Only the organizer can delete sub-events' });
        }

        const { count, error: countError } = await supabase
            .from('sub_event')
            .select('*', { count: 'exact', head: true })
            .eq('eid', subEvent[0].eid);

        if (countError) {
            console.error('Error counting sub-events:', countError);
            return res.status(500).json({ error: 'Database error' });
        }

        if (count <= 1) {
            return res.status(400).json({ error: 'Cannot delete the last sub-event' });
        }

        const { error: deleteError } = await supabase
            .from('sub_event')
            .delete()
            .eq('seid', seid);

        if (deleteError) {
            console.error('Error deleting sub-event:', deleteError);
            return res.status(500).json({ error: 'Failed to delete sub-event' });
        }

        res.json({ success: true, message: 'Sub-event deleted successfully' });
    } catch (err) {
        console.error('Error deleting sub-event:', err);
        res.status(500).json({ error: 'Error deleting sub-event' });
    }
});

app.get('/api/events/:eventId', requireAuth, async (req, res) => {
    try {
        const eventId = req.params.eventId;

        if (!eventId || isNaN(eventId)) {
            return res.status(400).json({ error: 'Invalid event ID' });
        }

        const { data: rows, error } = await supabase
            .from('event')
            .select(`
                eid, ename, eventdesc, eventdate, eventtime, eventloc, maxpart, maxvoln, regfee, orgusn, poster_url, activity_points,
                max_activity_pts, vol_activity_pts, min_part_scans, min_voln_scans,
                club:orgcid(cname),
                student:orgusn(sname)
            `)
            .eq('eid', eventId)
            .limit(1);

        if (error) {
            console.error('Error fetching event details:', error);
            return res.status(500).json({ error: 'Database error' });
        }

        if (!rows || rows.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }

        const event = rows[0];

        const transformedEvent = {
            ...event,
            eventDate: event.eventdate,
            eventTime: event.eventtime,
            eventLoc: event.eventloc,
            maxPart: event.maxpart,
            maxVoln: event.maxvoln,
            regFee: event.regfee,
            posterUrl: event.poster_url,
            activityPoints: event.activity_points || 0,
            maxActivityPts: event.max_activity_pts || 0,
            volActivityPts: event.vol_activity_pts || 0,
            minPartScans: event.min_part_scans || 1,
            minVolnScans: event.min_voln_scans || 1,
            clubName: event.club?.cname,
            organizerName: event.student?.sname,
            OrgUsn: event.orgusn
        };

        const { data: participantCheck } = await supabase
            .from('participant')
            .select('partstatus, payment_status')
            .eq('partusn', req.session.userUSN)
            .eq('parteid', eventId)
            .limit(1);

        const { data: volunteerCheck } = await supabase
            .from('volunteer')
            .select('volnstatus')
            .eq('volnusn', req.session.userUSN)
            .eq('volneid', eventId)
            .limit(1);

        transformedEvent.isRegistered = participantCheck && participantCheck.length > 0;
        transformedEvent.paymentStatus = participantCheck?.[0]?.payment_status || null;
        transformedEvent.isVolunteer = volunteerCheck && volunteerCheck.length > 0;
        transformedEvent.isOrganizer = event.orgusn === req.session.userUSN;

        res.json(transformedEvent);
    } catch (err) {
        console.error('Error fetching event details:', err);
        res.status(500).json({
            error: 'Error fetching event details: ' + err.message
        });
    }
});

app.get('/api/clubs', requireAuth, async (req, res) => {
    try {
        const { data: rows, error } = await supabase
            .from('club')
            .select('cid, cname, clubdesc');

        if (error) {
            console.error('Error fetching clubs:', error);
            return res.status(500).json({ error: 'Database error' });
        }

        res.json({
            clubs: rows || [],
            userUSN: req.session.userUSN
        });
    } catch (err) {
        console.error('Error fetching clubs:', err);
        res.status(500).json({ error: 'Error fetching clubs' });
    }
});

app.get('/api/my-clubs', requireAuth, async (req, res) => {
    try {
        const { data: rows, error } = await supabase
            .from('memberof')
            .select(`
                club:clubid (
                    cid,
                    cname,
                    clubdesc,
                    maxmembers
                )
            `)
            .eq('studentusn', req.session.userUSN);

        if (error) {
            console.error('Error fetching user clubs:', error);
            return res.status(500).json({ error: 'Database error' });
        }

        const clubs = (rows || []).map(row => row.club).filter(club => club);

        res.json({
            clubs: clubs,
            userUSN: req.session.userUSN
        });
    } catch (err) {
        console.error('Error fetching user clubs:', err);
        res.status(500).json({ error: 'Error fetching clubs' });
    }
});

app.get('/api/students', requireAuth, async (req, res) => {
    try {
        const { data: rows, error } = await supabase
            .from('student')
            .select('usn, sname, sem, mobno, emailid');

        if (error) {
            console.error('Error fetching students:', error);
            return res.status(500).json({ error: 'Database error' });
        }

        res.json({
            students: rows || [],
            currentUser: req.session.userUSN
        });
    } catch (err) {
        console.error('Error fetching students:', err);
        res.status(500).json({ error: 'Error fetching students: ' + err.message });
    }
});

function validateQRToken(seid, token, timestamp) {
    const now = Date.now();
    const ts = parseInt(timestamp, 10);

    if (isNaN(ts) || now - ts > QR_TOKEN_VALIDITY_MS) {
        return false;
    }

    const payload = `${seid}:${timestamp}`;
    const expected = crypto
        .createHmac('sha256', QR_TOKEN_SECRET)
        .update(payload)
        .digest('hex')
        .substring(0, 16);

    return crypto.timingSafeEqual(
        Buffer.from(token, 'utf8'),
        Buffer.from(expected, 'utf8')
    );
}

app.post('/api/mark-participant-attendance', requireAuth, async (req, res) => {
    try {
        const { seid, usn, token, timestamp } = req.body;

        if (usn !== req.session.userUSN) {
            return res.status(403).json({ error: 'Unauthorized: USN mismatch' });
        }

        if (!usn || !seid) {
            return res.status(400).json({ error: 'USN and Sub-event ID are required' });
        }

        if (!token || !timestamp) {
            return res.status(400).json({ error: 'QR code is outdated. Please scan a fresh code.' });
        }

        if (!validateQRToken(seid, token, timestamp)) {
            return res.status(401).json({ error: 'QR code has expired. Please ask the organizer to show a fresh code.' });
        }

        const { data: subEvent, error: subEventError } = await supabase
            .from('sub_event')
            .select('eid, se_name')
            .eq('seid', seid)
            .limit(1);

        if (subEventError || !subEvent?.length) {
            return res.status(404).json({ error: 'Sub-event not found' });
        }

        const eventId = subEvent[0].eid;

        const { data: existing, error: existingError } = await supabase
            .from('participant')
            .select('*')
            .eq('partusn', usn)
            .eq('parteid', eventId)
            .limit(1);

        if (existingError) return res.status(500).json({ error: 'Database error' });
        if (!existing?.length) return res.status(404).json({ error: 'You are not registered for this event' });
        if (existing[0].payment_status === 'pending_verification') {
            return res.status(400).json({ error: 'Your payment is pending verification' });
        }

        const { data: existingAttendance, error: attendanceError } = await supabase
            .from('sub_event_attendance')
            .select('*')
            .eq('seid', seid)
            .eq('usn', usn)
            .eq('role', 'participant')
            .limit(1);

        if (attendanceError) return res.status(500).json({ error: 'Database error' });
        if (existingAttendance?.length) {
            return res.status(400).json({ error: 'Attendance already marked for this sub-event' });
        }

        const { error: insertError } = await supabase
            .from('sub_event_attendance')
            .insert([{
                seid: parseInt(seid),
                eid: eventId,
                usn: usn,
                role: 'participant'
            }]);

        if (insertError) return res.status(500).json({ error: 'Failed to mark attendance' });

        const { count: scanCount, error: countError } = await supabase
            .from('sub_event_attendance')
            .select('*', { count: 'exact', head: true })
            .eq('eid', eventId)
            .eq('usn', usn)
            .eq('role', 'participant');

        if (countError) return res.status(500).json({ error: 'Database error' });

        const { data: eventData, error: eventError } = await supabase
            .from('event')
            .select('min_part_scans')
            .eq('eid', eventId)
            .limit(1);

        const minPartScans = eventData?.[0]?.min_part_scans || 1;
        const thresholdMet = (scanCount || 0) >= minPartScans;

        if (thresholdMet) {
            const { error: updateError } = await supabase
                .from('participant')
                .update({ partstatus: true })
                .eq('partusn', usn)
                .eq('parteid', eventId);

            if (updateError) return res.status(500).json({ error: 'Failed to update attendance status' });
        }

        console.log(`✅ Participant attendance: ${usn} for sub-event ${seid} (event ${eventId})`);
        res.json({
            success: true,
            message: 'Attendance marked',
            attendanceCount: scanCount || 0,
            minRequired: minPartScans,
            thresholdMet: thresholdMet
        });
    } catch (err) {
        console.error('Error marking participant attendance:', err);
        res.status(500).json({ error: 'Error marking attendance: ' + err.message });
    }
});

app.post('/api/mark-volunteer-attendance', requireAuth, async (req, res) => {
    try {
        const { seid, usn, token, timestamp } = req.body;

        if (usn !== req.session.userUSN) {
            return res.status(403).json({ error: 'Unauthorized: USN mismatch' });
        }

        if (!usn || !seid) {
            return res.status(400).json({ error: 'USN and Sub-event ID are required' });
        }

        if (!token || !timestamp) {
            return res.status(400).json({ error: 'QR code is outdated. Please scan a fresh code.' });
        }

        if (!validateQRToken(seid, token, timestamp)) {
            return res.status(401).json({ error: 'QR code has expired. Please ask the organizer to show a fresh code.' });
        }

        const { data: subEvent, error: subEventError } = await supabase
            .from('sub_event')
            .select('eid, se_name')
            .eq('seid', seid)
            .limit(1);

        if (subEventError || !subEvent?.length) {
            return res.status(404).json({ error: 'Sub-event not found' });
        }

        const eventId = subEvent[0].eid;

        const { data: existing, error: existingError } = await supabase
            .from('volunteer')
            .select('*')
            .eq('volnusn', usn)
            .eq('volneid', eventId)
            .limit(1);

        if (existingError) return res.status(500).json({ error: 'Database error' });
        if (!existing?.length) return res.status(404).json({ error: 'You are not registered as a volunteer for this event' });

        const { data: existingAttendance, error: attendanceError } = await supabase
            .from('sub_event_attendance')
            .select('*')
            .eq('seid', seid)
            .eq('usn', usn)
            .eq('role', 'volunteer')
            .limit(1);

        if (attendanceError) return res.status(500).json({ error: 'Database error' });
        if (existingAttendance?.length) {
            return res.status(400).json({ error: 'Attendance already marked for this sub-event' });
        }

        const { error: insertError } = await supabase
            .from('sub_event_attendance')
            .insert([{
                seid: parseInt(seid),
                eid: eventId,
                usn: usn,
                role: 'volunteer'
            }]);

        if (insertError) return res.status(500).json({ error: 'Failed to mark attendance' });

        const { count: scanCount, error: countError } = await supabase
            .from('sub_event_attendance')
            .select('*', { count: 'exact', head: true })
            .eq('eid', eventId)
            .eq('usn', usn)
            .eq('role', 'volunteer');

        if (countError) return res.status(500).json({ error: 'Database error' });

        const { data: eventData, error: eventError } = await supabase
            .from('event')
            .select('min_voln_scans')
            .eq('eid', eventId)
            .limit(1);

        const minVolnScans = eventData?.[0]?.min_voln_scans || 1;
        const thresholdMet = (scanCount || 0) >= minVolnScans;

        if (thresholdMet) {
            const { error: updateError } = await supabase
                .from('volunteer')
                .update({ volnstatus: true })
                .eq('volnusn', usn)
                .eq('volneid', eventId);

            if (updateError) return res.status(500).json({ error: 'Failed to update attendance status' });
        }

        console.log(`✅ Volunteer attendance: ${usn} for sub-event ${seid} (event ${eventId})`);
        res.json({
            success: true,
            message: 'Attendance marked',
            attendanceCount: scanCount || 0,
            minRequired: minVolnScans,
            thresholdMet: thresholdMet
        });
    } catch (err) {
        console.error('Error marking volunteer attendance:', err);
        res.status(500).json({ error: 'Error marking attendance: ' + err.message });
    }
});

// OLD scan-qr endpoint (DEPRECATED - kept for backward compatibility)
app.get('/api/scan-qr', async (req, res) => {
    try {
        const { usn, eid } = req.query;

        if (!usn || !eid) {
            return res.status(400).json({ error: 'USN and Event ID are required' });
        }

        const { data: existing, error: existingError } = await supabase
            .from('participant')
            .select('*')
            .eq('partusn', usn)
            .eq('parteid', eid)
            .limit(1);

        if (existingError) {
            console.error('Error checking participant:', existingError);
            return res.status(500).json({ error: 'Database error' });
        }

        if (!existing || existing.length === 0) {
            return res.status(404).json({ error: 'Participant not found for this event' });
        }

        if (existing[0].partstatus === true) {
            return res.status(400).json({ error: 'Participant already checked in' });
        }

        const { error: updateError } = await supabase
            .from('participant')
            .update({ partstatus: true })
            .eq('partusn', usn)
            .eq('parteid', eid);

        if (updateError) {
            console.error('Error updating participant status:', updateError);
            return res.status(500).json({ error: 'Database error' });
        }

        res.json({ success: true, message: 'Participant status updated to checked in' });
    } catch (err) {
        console.error('Error updating participant status:', err);
        res.status(500).json({ error: 'Error updating participant status: ' + err.message });
    }
});

// ==================== PASSWORD RESET ENDPOINTS ====================

app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) return res.status(400).json({ error: 'Email is required' });

        const { data: user, error: userError } = await supabase
            .from('student')
            .select('usn, sname, emailid')
            .eq('emailid', email)
            .limit(1);

        if (userError) {
            console.error('Error finding user:', userError);
            return res.status(500).json({ error: 'Database error' });
        }

        if (!user || user.length === 0) {
            console.log('Reset requested for non-existent email:', email);
            return res.json({
                success: true,
                message: 'If an account exists, you will receive a reset link.'
            });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpiry = new Date(Date.now() + 3600000);

        const { error: updateError } = await supabase
            .from('student')
            .update({
                reset_token: resetToken,
                reset_token_expiry: resetTokenExpiry.toISOString()
            })
            .eq('emailid', email);

        if (updateError) {
            console.error('Error saving token:', updateError);
            return res.status(500).json({ error: 'Failed to generate link' });
        }

        const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

        const sendSmtpEmail = new Brevo.SendSmtpEmail();
        sendSmtpEmail.subject = "Password Reset Request - E-Pass";
        sendSmtpEmail.sender = { "name": "E-Pass System", "email": "flopass333@gmail.com" };
        sendSmtpEmail.to = [{ "email": email, "name": user[0].sname }];
        sendSmtpEmail.htmlContent = `
            <html>
                <body style="font-family: Arial, sans-serif; color: #333;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #1A2980;">Password Reset</h2>
                        <p>Hello <strong>${user[0].sname}</strong>,</p>
                        <p>Click below to reset your password:</p>
                        <p>
                            <a href="${resetLink}" style="background-color: #1A2980; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
                        </p>
                        <p>Or copy this link: <br/>${resetLink}</p>
                        <p><i>This link expires in 1 hour.</i></p>
                    </div>
                </body>
            </html>
        `;

        const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
        console.log('✅ Email sent via Brevo. Message ID:', data.messageId);

        res.json({
            success: true,
            message: 'If an account exists, you will receive a reset link.'
        });

    } catch (err) {
        console.error('Error in forgot password:', err);
        if (err.body) console.error('Brevo Error Body:', err.body);
        res.status(500).json({ error: 'Failed to process request' });
    }
});

app.post('/api/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({ error: 'Token and new password are required' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long' });
        }

        const { data: user, error: userError } = await supabase
            .from('student')
            .select('usn, sname, emailid, reset_token_expiry')
            .eq('reset_token', token)
            .limit(1);

        if (userError) {
            console.error('Error finding user with token:', userError);
            return res.status(500).json({ error: 'Database error' });
        }
        if (!user || user.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired reset link' });
        }

        const tokenExpiry = new Date(user[0].reset_token_expiry);
        if (tokenExpiry < new Date()) {
            return res.status(400).json({ error: 'Reset link has expired. Please request a new one.' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        const { error: updateError } = await supabase
            .from('student')
            .update({
                password: hashedPassword,
                reset_token: null,
                reset_token_expiry: null
            })
            .eq('reset_token', token);

        if (updateError) {
            console.error('Error updating password:', updateError);
            return res.status(500).json({ error: 'Failed to reset password' });
        }

        console.log('✅ Password reset successful for:', user[0].usn);
        res.json({
            success: true,
            message: 'Password reset successfully! You can now sign in with your new password.',
            userName: user[0].sname
        });
    } catch (err) {
        console.error('Error in reset password:', err);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

// ==================== UPI PAYMENT ENDPOINTS ====================

app.post('/api/events/:eventId/register-upi', requireAuth, async (req, res) => {
    try {
        const eventId = req.params.eventId;
        const userUSN = req.session.userUSN;
        const { transaction_id } = req.body;

        if (!transaction_id) {
            return res.status(400).json({ error: 'Transaction ID is required' });
        }

        const { data: existing, error: existingError } = await supabase
            .from('participant')
            .select('*')
            .eq('partusn', userUSN)
            .eq('parteid', eventId)
            .limit(1);

        if (existingError) {
            console.error('Error checking existing participant:', existingError);
            return res.status(500).json({ error: 'Database error' });
        }

        if (existing && existing.length > 0) {
            return res.status(400).json({ error: 'You are already registered for this event' });
        }

        const { data: eventData, error: eventError } = await supabase
            .from('event')
            .select('regfee, maxpart')
            .eq('eid', eventId)
            .limit(1);

        if (eventError) {
            console.error('Error fetching event fee:', eventError);
            return res.status(500).json({ error: 'Database error' });
        }

        const amount = eventData?.[0]?.regfee || 0;
        const maxPart = eventData?.[0]?.maxpart || 0;

        if (amount <= 0) {
            return res.status(400).json({ error: 'This is not a paid event' });
        }

        if (maxPart > 0) {
            const { count, error: countError } = await supabase
                .from('participant')
                .select('*', { count: 'exact', head: true })
                .eq('parteid', eventId);

            if (countError) {
                console.error('Error counting participants:', countError);
                return res.status(500).json({ error: 'Database error' });
            }
            if (count >= maxPart) {
                return res.status(400).json({ error: 'Event is full' });
            }
        }

        const { error: paymentError } = await supabase.from('payment').insert([{
            usn: userUSN,
            event_id: eventId,
            amount,
            status: 'pending_verification',
            upi_transaction_id: transaction_id
        }]);

        if (paymentError) {
            console.error('Error saving payment record:', paymentError);
            return res.status(500).json({ error: 'Failed to save payment' });
        }

        const { error: insertError } = await supabase
            .from('participant')
            .insert([{
                partusn: userUSN,
                parteid: eventId,
                partstatus: false,
                payment_status: 'pending_verification'
            }]);

        if (insertError) {
            console.error('Error inserting participant after UPI:', insertError);
            return res.status(500).json({ error: 'Failed to register participant' });
        }

        console.log(`✅ UPI registration submitted: ${userUSN} for event ${eventId}`);
        res.json({
            success: true,
            message: 'Registration submitted! Your payment is pending verification by the organizer.',
            userUSN: userUSN
        });
    } catch (err) {
        console.error('Error in UPI registration:', err);
        res.status(500).json({ error: 'Error submitting registration' });
    }
});

// ==================== PAYMENT VERIFICATION ENDPOINTS ====================

app.post('/api/payments/verify', requireAuth, async (req, res) => {
    try {
        const { participantUSN, eventId } = req.body;
        const organizerUSN = req.session.userUSN;

        if (!participantUSN || !eventId) {
            return res.status(400).json({ error: 'Participant USN and Event ID are required' });
        }

        const { data: event, error: eventError } = await supabase
            .from('event')
            .select('orgusn, is_team')
            .eq('eid', eventId)
            .limit(1);

        if (eventError || !event || event.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }

        if (event[0].orgusn !== organizerUSN) {
            return res.status(403).json({ error: 'Not authorized to verify payments for this event' });
        }

        const isTeamEvent = event[0].is_team;

        if (isTeamEvent) {
            const { data: teamData } = await supabase
                .from('team')
                .select('id')
                .eq('event_id', eventId)
                .eq('leader_usn', participantUSN)
                .limit(1);

            const teamId = teamData?.[0]?.id;

            if (teamId) {
                const { data: teamMembers, error: teamMembersError } = await supabase
                    .from('team_members')
                    .select('student_usn')
                    .eq('team_id', teamId)
                    .eq('join_status', true);

                if (teamMembersError) {
                    console.error('Error fetching team members:', teamMembersError);
                    return res.status(500).json({ error: 'Failed to fetch team members' });
                }

                const allTeamUSNs = teamMembers.map(m => m.student_usn);

                const { error: paymentUpdateError } = await supabase
                    .from('payment')
                    .update({ status: 'verified' })
                    .eq('event_id', eventId)
                    .eq('usn', participantUSN)
                    .eq('status', 'pending_verification');

                if (paymentUpdateError) {
                    console.error('Error updating payment status:', paymentUpdateError);
                    return res.status(500).json({ error: 'Failed to update payment status' });
                }

                const { error: participantUpdateError } = await supabase
                    .from('participant')
                    .update({ payment_status: 'verified' })
                    .in('partusn', allTeamUSNs)
                    .eq('parteid', eventId);

                if (participantUpdateError) {
                    console.error('Error updating participant status:', participantUpdateError);
                    return res.status(500).json({ error: 'Failed to update participant status' });
                }

                console.log(`✅ Payment verified for entire team (${allTeamUSNs.length} members): Team ID ${teamId} for event ${eventId} by ${organizerUSN}`);

                return res.json({
                    success: true,
                    message: `Payment verified for entire team (${allTeamUSNs.length} members)!`,
                    verifiedCount: allTeamUSNs.length
                });
            }
        }

        const { error: paymentUpdateError } = await supabase
            .from('payment')
            .update({ status: 'verified' })
            .eq('usn', participantUSN)
            .eq('event_id', eventId)
            .eq('status', 'pending_verification');

        if (paymentUpdateError) {
            console.error('Error updating payment status:', paymentUpdateError);
            return res.status(500).json({ error: 'Failed to update payment status' });
        }

        const { error: participantUpdateError } = await supabase
            .from('participant')
            .update({ payment_status: 'verified' })
            .eq('partusn', participantUSN)
            .eq('parteid', eventId);

        if (participantUpdateError) {
            console.error('Error updating participant status:', participantUpdateError);
            return res.status(500).json({ error: 'Failed to update participant status' });
        }

        console.log(`✅ Payment verified: ${participantUSN} for event ${eventId} by ${organizerUSN}`);

        return res.json({
            success: true,
            message: 'Payment verified successfully!'
        });
    } catch (err) {
        console.error('Error verifying payment:', err);
        res.status(500).json({ error: 'Error verifying payment' });
    }
});

app.get('/api/events/:eventId/pending-payments', requireAuth, async (req, res) => {
    try {
        const eventId = req.params.eventId;
        const userUSN = req.session.userUSN;

        const { data: event, error: eventError } = await supabase
            .from('event')
            .select('orgusn, ename, is_team')
            .eq('eid', eventId)
            .limit(1);

        if (eventError || !event || event.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }

        if (event[0].orgusn !== userUSN) {
            return res.status(403).json({ error: 'Not authorized to view payments for this event' });
        }

        const isTeamEvent = event[0].is_team;
        let paymentsToShow = [];

        if (isTeamEvent) {
            const { data: pendingPayments, error: paymentsError } = await supabase
                .from('payment')
                .select(`
                    usn,
                    amount,
                    upi_transaction_id,
                    created_at,
                    status,
                    student:usn (
                        sname,
                        emailid,
                        mobno
                    )
                `)
                .eq('event_id', eventId)
                .eq('status', 'pending_verification');

            if (paymentsError) {
                console.error('Error fetching payments:', paymentsError);
                return res.status(500).json({ error: 'Database error' });
            }

            for (const payment of pendingPayments || []) {
                const { data: teamData } = await supabase
                    .from('team')
                    .select('id, team_name, leader_usn')
                    .eq('event_id', eventId)
                    .eq('leader_usn', payment.usn)
                    .limit(1);

                if (teamData && teamData.length > 0) {
                    const { count: memberCount } = await supabase
                        .from('team_members')
                        .select('*', { count: 'exact', head: true })
                        .eq('team_id', teamData[0].id)
                        .eq('join_status', true);

                    paymentsToShow.push({
                        partusn: payment.usn,
                        studentName: payment.student?.sname || 'Unknown',
                        studentEmail: payment.student?.emailid || 'N/A',
                        studentMobile: payment.student?.mobno || 'N/A',
                        transactionId: payment.upi_transaction_id || 'N/A',
                        amount: payment.amount || 0,
                        submittedAt: payment.created_at || null,
                        teamName: teamData[0].team_name || 'Unknown Team',
                        teamMemberCount: memberCount || 1,
                        isTeamLeader: true
                    });
                }
            }
        } else {
            const { data: pendingPayments, error: paymentsError } = await supabase
                .from('payment')
                .select(`
                    usn,
                    amount,
                    upi_transaction_id,
                    created_at,
                    status,
                    student:usn (
                        sname,
                        emailid,
                        mobno
                    )
                `)
                .eq('event_id', eventId)
                .eq('status', 'pending_verification');

            if (paymentsError) {
                console.error('Error fetching payments:', paymentsError);
                return res.status(500).json({ error: 'Database error' });
            }

            paymentsToShow = (pendingPayments || []).map(payment => ({
                partusn: payment.usn,
                studentName: payment.student?.sname || 'Unknown',
                studentEmail: payment.student?.emailid || 'N/A',
                studentMobile: payment.student?.mobno || 'N/A',
                transactionId: payment.upi_transaction_id || 'N/A',
                amount: payment.amount || 0,
                submittedAt: payment.created_at || null,
                teamName: null,
                isTeamLeader: false
            }));
        }

        console.log(`✅ Found ${paymentsToShow.length} pending payments for event ${eventId}`);
        res.json({
            success: true,
            pendingPayments: paymentsToShow,
            isTeamEvent
        });
    } catch (err) {
        console.error('Error fetching pending payments:', err);
        res.status(500).json({ error: 'Error fetching pending payments' });
    }
});

// ==================== TEAM EVENTS ENDPOINTS ====================

app.post('/api/events/:eventId/create-team', requireAuth, async (req, res) => {
    try {
        const eventId = req.params.eventId;
        const userUSN = req.session.userUSN;
        const { teamName, memberUSNs } = req.body;

        if (!teamName || !Array.isArray(memberUSNs)) {
            return res.status(400).json({ error: 'Team name and member USNs are required' });
        }

        const { data: event, error: eventError } = await supabase
            .from('event')
            .select('eid, ename, is_team, min_team_size, max_team_size, regfee')
            .eq('eid', eventId)
            .limit(1);

        if (eventError || !event || event.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }

        if (!event[0].is_team) {
            return res.status(400).json({ error: 'This is not a team event' });
        }

        const minSize = event[0].min_team_size;
        const maxSize = event[0].max_team_size;

        const totalMembers = memberUSNs.length + 1;
        if (maxSize && totalMembers > maxSize) {
            return res.status(400).json({
                error: `Team size cannot exceed ${maxSize} members (including leader)`
            });
        }

        const { data: existingTeam } = await supabase
            .from('team_members')
            .select('team_id, join_status, team:team_id(event_id, leader_usn)')
            .eq('student_usn', userUSN);

        if (existingTeam && existingTeam.length > 0) {
            const joinedTeam = existingTeam.find(tm =>
                tm.join_status === true &&
                tm.team?.event_id === parseInt(eventId)
            );

            if (joinedTeam) {
                return res.status(400).json({
                    error: 'You have already joined a team for this event. Leave that team first to create a new one.'
                });
            }
        }

        if (memberUSNs.length > 0) {
            const { data: students, error: studentError } = await supabase
                .from('student')
                .select('usn, sname')
                .in('usn', memberUSNs);

            if (studentError || !students || students.length !== memberUSNs.length) {
                return res.status(400).json({
                    error: 'One or more member USNs are invalid'
                });
            }

            const { data: memberTeamCheck } = await supabase
                .from('team_members')
                .select('student_usn, join_status, team:team_id(event_id)')
                .in('student_usn', memberUSNs)
                .eq('join_status', true);

            if (memberTeamCheck && memberTeamCheck.length > 0) {
                const conflicts = memberTeamCheck.filter(m =>
                    m.team?.event_id === parseInt(eventId)
                );
                if (conflicts.length > 0) {
                    return res.status(400).json({
                        error: `Member ${conflicts[0].student_usn} has already joined another team for this event`
                    });
                }
            }
        }

        const { data: teamData, error: teamError } = await supabase
            .from('team')
            .insert([{
                team_name: teamName,
                leader_usn: userUSN,
                event_id: eventId,
                registration_complete: false
            }])
            .select('id');

        if (teamError || !teamData || teamData.length === 0) {
            console.error('Error creating team:', teamError);
            return res.status(500).json({ error: 'Failed to create team' });
        }

        const teamId = teamData[0].id;

        const teamMembersToInsert = [{
            team_id: teamId,
            student_usn: userUSN,
            join_status: true
        }];

        memberUSNs.forEach(usn => {
            teamMembersToInsert.push({
                team_id: teamId,
                student_usn: usn,
                join_status: false
            });
        });

        const { error: membersError } = await supabase
            .from('team_members')
            .insert(teamMembersToInsert);

        if (membersError) {
            console.error('Error adding team members:', membersError);
            await supabase.from('team').delete().eq('id', teamId);
            return res.status(500).json({ error: 'Failed to add team members' });
        }

        console.log(`✅ Team created: ${teamName} (ID: ${teamId}) by ${userUSN}`);

        res.json({
            success: true,
            message: 'Team created successfully! Invitations sent to members.',
            teamId,
            minSize,
            currentSize: 1,
            canRegister: minSize <= 1
        });
    } catch (err) {
        console.error('Error creating team:', err);
        res.status(500).json({ error: 'Error creating team' });
    }
});

app.post('/api/events/:eventId/join-team', requireAuth, async (req, res) => {
    try {
        const eventId = req.params.eventId;
        const userUSN = req.session.userUSN;
        const { leaderUSN } = req.body;

        if (!leaderUSN) {
            return res.status(400).json({ error: 'Team leader USN is required' });
        }

        const { data: existingMembership } = await supabase
            .from('team_members')
            .select('team_id, team:team_id(event_id, registration_complete)')
            .eq('student_usn', userUSN);

        if (existingMembership && existingMembership.length > 0) {
            const inEventTeam = existingMembership.find(m =>
                m.team?.event_id === parseInt(eventId)
            );
            if (inEventTeam) {
                if (inEventTeam.team.registration_complete) {
                    return res.status(400).json({
                        error: 'Your team is already registered for this event'
                    });
                }
                return res.status(400).json({
                    error: 'You are already part of a team for this event'
                });
            }
        }

        const { data: team, error: teamError } = await supabase
            .from('team')
            .select('id, team_name, registration_complete, max_team_size:event_id(max_team_size)')
            .eq('leader_usn', leaderUSN)
            .eq('event_id', eventId)
            .limit(1);

        if (teamError || !team || team.length === 0) {
            return res.status(404).json({
                error: 'Team not found. Please check the team leader USN.'
            });
        }

        const teamId = team[0].id;

        if (team[0].registration_complete) {
            return res.status(400).json({
                error: 'This team has already completed registration'
            });
        }

        const { data: membership, error: membershipError } = await supabase
            .from('team_members')
            .select('join_status')
            .eq('team_id', teamId)
            .eq('student_usn', userUSN)
            .limit(1);

        if (membershipError || !membership || membership.length === 0) {
            return res.status(403).json({
                error: 'You are not invited to this team'
            });
        }

        if (membership[0].join_status) {
            return res.status(400).json({
                error: 'You have already joined this team'
            });
        }

        const { error: updateError } = await supabase
            .from('team_members')
            .update({ join_status: true })
            .eq('team_id', teamId)
            .eq('student_usn', userUSN);

        if (updateError) {
            console.error('Error updating join status:', updateError);
            return res.status(500).json({ error: 'Failed to join team' });
        }

        res.json({
            success: true,
            message: `Successfully joined team "${team[0].team_name}"!`,
            teamId
        });
    } catch (err) {
        console.error('Error joining team:', err);
        res.status(500).json({ error: 'Error joining team' });
    }
});

app.get('/api/events/:eventId/team-status', requireAuth, async (req, res) => {
    try {
        const eventId = req.params.eventId;
        const userUSN = req.session.userUSN;

        const { data: event } = await supabase
            .from('event')
            .select('is_team, min_team_size, max_team_size, regfee')
            .eq('eid', eventId)
            .limit(1);

        if (!event || event.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }

        if (!event[0].is_team) {
            return res.json({ isTeamEvent: false });
        }

        const { data: leaderTeam } = await supabase
            .from('team')
            .select('id, team_name, registration_complete')
            .eq('leader_usn', userUSN)
            .eq('event_id', eventId)
            .limit(1);

        if (leaderTeam && leaderTeam.length > 0) {
            const teamId = leaderTeam[0].id;

            const { data: members } = await supabase
                .from('team_members')
                .select('student_usn, join_status, student:student_usn(sname)')
                .eq('team_id', teamId);

            const joinedCount = members?.filter(m => m.join_status).length || 0;
            const canRegister = joinedCount >= event[0].min_team_size;

            return res.json({
                isTeamEvent: true,
                isLeader: true,
                hasJoinedTeam: true,
                teamId,
                teamName: leaderTeam[0].team_name,
                members: members || [],
                joinedCount,
                minSize: event[0].min_team_size,
                maxSize: event[0].max_team_size,
                canRegister,
                registrationComplete: leaderTeam[0].registration_complete,
                regFee: event[0].regfee
            });
        }

        const { data: memberTeam } = await supabase
            .from('team_members')
            .select(`
                team_id,
                join_status,
                team:team_id(
                    id,
                    team_name,
                    leader_usn,
                    registration_complete,
                    event_id,
                    leader:leader_usn(sname)
                )
            `)
            .eq('student_usn', userUSN)
            .eq('join_status', true);

        if (memberTeam && memberTeam.length > 0) {
            const teamInEvent = memberTeam.find(m =>
                m.team?.event_id === parseInt(eventId)
            );

            if (teamInEvent) {
                const { data: teamDetails } = await supabase
                    .from('team_members')
                    .select('student_usn, join_status, student:student_usn(sname)')
                    .eq('team_id', teamInEvent.team.id);

                return res.json({
                    isTeamEvent: true,
                    isLeader: false,
                    isMember: true,
                    hasJoinedTeam: true,
                    teamId: teamInEvent.team.id,
                    teamName: teamInEvent.team.team_name,
                    leaderUSN: teamInEvent.team.leader_usn,
                    leaderName: teamInEvent.team.leader?.sname,
                    registrationComplete: teamInEvent.team.registration_complete,
                    minSize: event[0].min_team_size,
                    maxSize: event[0].max_team_size,
                    members: teamDetails || [],
                    joinedCount: teamDetails?.filter(m => m.join_status).length || 0
                });
            }
        }

        res.json({
            isTeamEvent: true,
            isLeader: false,
            isMember: false,
            hasJoinedTeam: false,
            minSize: event[0].min_team_size,
            maxSize: event[0].max_team_size,
            regFee: event[0].regfee
        });
    } catch (err) {
        console.error('Error getting team status:', err);
        res.status(500).json({ error: 'Error getting team status' });
    }
});

app.post('/api/events/:eventId/register-team', requireAuth, async (req, res) => {
    try {
        const eventId = req.params.eventId;
        const userUSN = req.session.userUSN;

        const { data: team, error: teamError } = await supabase
            .from('team')
            .select('id, registration_complete, event:event_id(regfee, min_team_size)')
            .eq('leader_usn', userUSN)
            .eq('event_id', eventId)
            .limit(1);

        if (teamError || !team || team.length === 0) {
            return res.status(404).json({
                error: 'Team not found or you are not the team leader'
            });
        }

        if (team[0].registration_complete) {
            return res.status(400).json({
                error: 'Team is already registered for this event'
            });
        }

        const teamId = team[0].id;
        const regFee = team[0].event?.regfee || 0;
        const minSize = team[0].event?.min_team_size || 2;

        const { data: members } = await supabase
            .from('team_members')
            .select('student_usn, join_status')
            .eq('team_id', teamId)
            .eq('join_status', true);

        const joinedCount = members?.length || 0;

        if (joinedCount < minSize) {
            return res.status(400).json({
                error: `Minimum ${minSize} members must join before registration. Currently ${joinedCount} members have joined.`
            });
        }

        if (regFee > 0) {
            return res.json({
                success: true,
                requiresPayment: true,
                message: 'Payment required for team registration',
                teamId,
                regFee
            });
        }

        const { error: updateError } = await supabase
            .from('team')
            .update({ registration_complete: true })
            .eq('id', teamId);

        if (updateError) {
            console.error('Error completing team registration:', updateError);
            return res.status(500).json({ error: 'Failed to complete registration' });
        }

        const participantsToInsert = members.map(m => ({
            partusn: m.student_usn,
            parteid: eventId,
            partstatus: false,
            payment_status: 'free',
            team_id: teamId
        }));

        const { error: participantError } = await supabase
            .from('participant')
            .insert(participantsToInsert);

        if (participantError) {
            console.error('Error adding participants:', participantError);
            return res.status(500).json({ error: 'Failed to add team members as participants' });
        }

        res.json({
            success: true,
            message: 'Team registered successfully!',
            teamId,
            userUSN: userUSN
        });
    } catch (err) {
        console.error('Error registering team:', err);
        res.status(500).json({ error: 'Error registering team' });
    }
});

app.post('/api/events/:eventId/register-team-upi', requireAuth, async (req, res) => {
    try {
        const eventId = req.params.eventId;
        const userUSN = req.session.userUSN;
        const { transaction_id } = req.body;

        if (!transaction_id) {
            return res.status(400).json({ error: 'Transaction ID is required' });
        }

        const { data: team, error: teamError } = await supabase
            .from('team')
            .select('id, registration_complete, event:event_id(regfee, min_team_size, maxpart)')
            .eq('leader_usn', userUSN)
            .eq('event_id', eventId)
            .limit(1);

        if (teamError || !team || team.length === 0) {
            return res.status(404).json({
                error: 'Team not found or you are not the team leader'
            });
        }

        if (team[0].registration_complete) {
            return res.status(400).json({
                error: 'Team is already registered for this event'
            });
        }

        const teamId = team[0].id;
        const regFee = team[0].event?.regfee || 0;
        const minSize = team[0].event?.min_team_size || 2;
        const maxPart = team[0].event?.maxpart || 0;

        if (regFee <= 0) {
            return res.status(400).json({ error: 'This is not a paid event' });
        }

        const { data: members, error: memberError } = await supabase
            .from('team_members')
            .select('student_usn, join_status')
            .eq('team_id', teamId)
            .eq('join_status', true);

        if (memberError) {
            return res.status(500).json({ error: 'Failed to get team members' });
        }

        const joinedCount = members?.length || 0;

        if (joinedCount < minSize) {
            return res.status(400).json({
                error: `Minimum ${minSize} members must join before registration.`
            });
        }

        if (maxPart > 0) {
            const { count, error: countError } = await supabase
                .from('team')
                .select('*', { count: 'exact', head: true })
                .eq('event_id', eventId)
                .eq('registration_complete', true);

            if (countError) {
                return res.status(500).json({ error: 'Database error' });
            }
            if (count >= maxPart) {
                return res.status(400).json({ error: 'Event is full (no more teams)' });
            }
        }

        const { error: paymentError } = await supabase.from('payment').insert([{
            usn: userUSN,
            event_id: eventId,
            amount: regFee,
            status: 'pending_verification',
            upi_transaction_id: transaction_id
        }]);

        if (paymentError) {
            console.error('Error saving payment record:', paymentError);
            return res.status(500).json({ error: 'Failed to save payment' });
        }

        const { error: updateError } = await supabase
            .from('team')
            .update({ registration_complete: true })
            .eq('id', teamId);

        if (updateError) {
            return res.status(500).json({ error: 'Failed to update team status' });
        }

        const participantsToInsert = members.map(m => ({
            partusn: m.student_usn,
            parteid: eventId,
            partstatus: false,
            payment_status: 'pending_verification',
            team_id: teamId
        }));

        const { error: participantError } = await supabase
            .from('participant')
            .insert(participantsToInsert);

        if (participantError) {
            return res.status(500).json({ error: 'Failed to register team members' });
        }

        res.json({
            success: true,
            message: 'Team registration submitted! Your payment is pending verification.',
            userUSN: userUSN
        });
    } catch (err) {
        console.error('Error registering team with UPI:', err);
        res.status(500).json({ error: 'Error registering team' });
    }
});

app.post('/api/teams/:teamId/add-members', requireAuth, async (req, res) => {
    try {
        const teamId = req.params.teamId;
        const userUSN = req.session.userUSN;
        const { memberUSNs } = req.body;

        if (!Array.isArray(memberUSNs) || memberUSNs.length === 0) {
            return res.status(400).json({ error: 'Member USNs are required' });
        }

        const { data: team } = await supabase
            .from('team')
            .select('leader_usn, event_id, registration_complete, event:event_id(max_team_size)')
            .eq('id', teamId)
            .limit(1);

        if (!team || team.length === 0) {
            return res.status(404).json({ error: 'Team not found' });
        }

        if (team[0].leader_usn !== userUSN) {
            return res.status(403).json({ error: 'Only team leader can add members' });
        }

        if (team[0].registration_complete) {
            return res.status(400).json({
                error: 'Cannot add members to a registered team'
            });
        }

        const { count: currentSize } = await supabase
            .from('team_members')
            .select('*', { count: 'exact', head: true })
            .eq('team_id', teamId);

        const maxSize = team[0].event?.max_team_size;
        if (maxSize && (currentSize + memberUSNs.length) > maxSize) {
            return res.status(400).json({
                error: `Cannot exceed maximum team size of ${maxSize}`
            });
        }

        const { data: students } = await supabase
            .from('student')
            .select('usn')
            .in('usn', memberUSNs);

        if (!students || students.length !== memberUSNs.length) {
            return res.status(400).json({
                error: 'One or more member USNs are invalid'
            });
        }

        const { data: conflictCheck } = await supabase
            .from('team_members')
            .select('student_usn, team:team_id(event_id)')
            .in('student_usn', memberUSNs);

        if (conflictCheck && conflictCheck.length > 0) {
            const conflicts = conflictCheck.filter(m =>
                m.team?.event_id === team[0].event_id
            );
            if (conflicts.length > 0) {
                return res.status(400).json({
                    error: `Member ${conflicts[0].student_usn} is already in another team`
                });
            }
        }

        const membersToInsert = memberUSNs.map(usn => ({
            team_id: teamId,
            student_usn: usn,
            join_status: false
        }));

        const { error: insertError } = await supabase
            .from('team_members')
            .insert(membersToInsert);

        if (insertError) {
            console.error('Error adding members:', insertError);
            return res.status(500).json({ error: 'Failed to add members' });
        }

        res.json({
            success: true,
            message: 'Members added successfully!'
        });
    } catch (err) {
        console.error('Error adding members:', err);
        res.status(500).json({ error: 'Error adding members' });
    }
});

app.get('/api/events/:eventId/my-invites', requireAuth, async (req, res) => {
    try {
        const eventId = req.params.eventId;
        const userUSN = req.session.userUSN;

        const { data: invites, error } = await supabase
            .from('team_members')
            .select(`
                team_id,
                join_status,
                team:team_id (
                    id,
                    team_name,
                    leader_usn,
                    event_id,
                    registration_complete,
                    leader:leader_usn(sname)
                )
            `)
            .eq('student_usn', userUSN)
            .eq('join_status', false);

        if (error) {
            console.error('Error fetching invites:', error);
            return res.status(500).json({ error: 'Database error' });
        }

        const eventInvites = (invites || [])
            .filter(invite => invite.team?.event_id === parseInt(eventId))
            .map(invite => ({
                teamId: invite.team.id,
                teamName: invite.team.team_name,
                leaderUSN: invite.team.leader_usn,
                leaderName: invite.team.leader?.sname || 'Unknown',
                joinStatus: invite.join_status,
                registrationComplete: invite.team.registration_complete
            }));

        res.json({
            success: true,
            invites: eventInvites
        });
    } catch (err) {
        console.error('Error fetching invites:', err);
        res.status(500).json({ error: 'Error fetching invites' });
    }
});

app.post('/api/teams/:teamId/confirm-join', requireAuth, async (req, res) => {
    try {
        const teamId = req.params.teamId;
        const userUSN = req.session.userUSN;

        console.log(`Confirming join for user ${userUSN} to team ${teamId}`);

        const { data: membership, error: membershipError } = await supabase
            .from('team_members')
            .select('join_status, team:team_id(event_id, registration_complete, team_name)')
            .eq('team_id', teamId)
            .eq('student_usn', userUSN)
            .limit(1);

        if (membershipError) {
            console.error('Error checking membership:', membershipError);
            return res.status(500).json({ error: 'Database error' });
        }

        if (!membership || membership.length === 0) {
            return res.status(404).json({
                error: 'You are not invited to this team'
            });
        }

        if (membership[0].join_status) {
            return res.status(400).json({
                error: 'You have already joined this team'
            });
        }

        if (membership[0].team.registration_complete) {
            return res.status(400).json({
                error: 'This team has already completed registration'
            });
        }

        const { data: otherTeams } = await supabase
            .from('team_members')
            .select('team_id, team:team_id(event_id)')
            .eq('student_usn', userUSN)
            .eq('join_status', true);

        if (otherTeams && otherTeams.length > 0) {
            const conflictTeam = otherTeams.find(t =>
                t.team?.event_id === membership[0].team.event_id
            );
            if (conflictTeam) {
                return res.status(400).json({
                    error: 'You have already joined another team for this event'
                });
            }
        }

        const { error: updateError } = await supabase
            .from('team_members')
            .update({ join_status: true })
            .eq('team_id', teamId)
            .eq('student_usn', userUSN);

        if (updateError) {
            console.error('Error updating join status:', updateError);
            return res.status(500).json({ error: 'Failed to join team' });
        }

        console.log(`✅ User ${userUSN} successfully joined team ${teamId}`);

        res.json({
            success: true,
            message: `Successfully joined team "${membership[0].team.team_name}"!`,
            teamId
        });
    } catch (err) {
        console.error('Error confirming join:', err);
        res.status(500).json({ error: 'Error confirming join' });
    }
});

// ==================== EXCEL GENERATION ====================
app.get('/api/events/:eventId/generate-details', requireAuth, async (req, res) => {
    try {
        const eventId = req.params.eventId;
        const userUSN = req.session.userUSN;

        const { data: event, error: eventError } = await supabase
            .from('event')
            .select(`
                eid, ename, eventdate, eventtime, eventloc, orgusn,
                max_activity_pts, vol_activity_pts,
                student:orgusn(sname, usn)
            `)
            .eq('eid', eventId)
            .limit(1);

        if (eventError || !event?.[0]) return res.status(404).json({ error: 'Event not found' });
        if (event[0].orgusn !== userUSN) return res.status(403).json({ error: 'Not authorized' });

        const eventData = event[0];

        const { data: participants, error: participantError } = await supabase
            .from('participant')
            .select(`
                partusn,
                partstatus,
                payment_status,
                team_id,
                student:partusn (
                    sname, sem, mobno, emailid,
                    payment!payment_usn_fkey (upi_transaction_id, amount)
                ),
                team:team_id (team_name)
            `)
            .eq('parteid', eventId);

        if (participantError) {
            console.error('Error fetching participants:', participantError);
            return res.status(500).json({ error: 'Database error (participants)' });
        }

        const { data: volunteers, error: volunteerError } = await supabase
            .from('volunteer')
            .select(`
                volnusn,
                volnstatus,
                student:volnusn (sname)
            `)
            .eq('volneid', eventId);

        if (volunteerError) {
            console.error('Error fetching volunteers:', volunteerError);
            return res.status(500).json({ error: 'Database error (volunteers)' });
        }

        const workbook = new ExcelJS.Workbook();
        const ws = workbook.addWorksheet('Event Details');

        ws.columns = [
            { width: 15 }, { width: 25 }, { width: 10 }, { width: 15 }, { width: 30 },
            { width: 15 }, { width: 20 }, { width: 20 },
            { width: 30 }, { width: 15 }, { width: 20 }
        ];

        const hdr = ws.addRow(['EVENT DETAILS']);
        hdr.font = { size: 16, bold: true };
        hdr.alignment = { horizontal: 'center' };
        ws.mergeCells('A1:J1');

        ws.addRow([]);
        ws.addRow(['Event Name:', eventData.ename]);
        ws.addRow(['Event Date:', eventData.eventdate]);
        ws.addRow(['Event Time:', eventData.eventtime]);
        ws.addRow(['Event Location:', eventData.eventloc]);
        ws.addRow(['Organiser USN:', eventData.student.usn]);
        ws.addRow(['Organiser Name:', eventData.student.sname]);

        for (let i = 3; i <= 8; i++) {
            ws.getRow(i).font = { bold: true };
            ws.getRow(i).getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
        }

        ws.addRow([]);
        const partHdr = ws.addRow(['PARTICIPANTS']);
        partHdr.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
        partHdr.alignment = { horizontal: 'center' };
        ws.mergeCells(`A${partHdr.number}:J${partHdr.number}`);
        partHdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };

        const partCols = ws.addRow([
            'USN', 'Name', 'Semester', 'Mobile No', 'Email',
            'Participation Status', 'Payment Status', 'Team Name',
            'UPI Transaction ID', 'Payment Amount', 'Activity Points Earned'
        ]);
        partCols.font = { bold: true };
        partCols.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };

        const maxActivityPts = eventData.max_activity_pts || 0;

        const { data: attendanceMapData } = await supabase
            .from('sub_event_attendance')
            .select('usn, sub_event!inner(activity_pts)')
            .eq('eid', eventId)
            .eq('role', 'participant');

        const usnToPtsMap = {};
        (attendanceMapData || []).forEach(row => {
            if (!usnToPtsMap[row.usn]) usnToPtsMap[row.usn] = 0;
            usnToPtsMap[row.usn] += row.sub_event?.activity_pts || 0;
        });

        (participants || []).forEach(p => {
            const payment = Array.isArray(p.student?.payment) ?
                p.student.payment.find(pay => pay.upi_transaction_id) : p.student?.payment;

            const earnedPts = p.partstatus ? Math.min(usnToPtsMap[p.partusn] || 0, maxActivityPts) : 0;

            ws.addRow([
                p.partusn || 'N/A',
                p.student?.sname || 'N/A',
                p.student?.sem || 'N/A',
                p.student?.mobno || 'N/A',
                p.student?.emailid || 'N/A',
                p.partstatus ? 'Present' : 'Absent',
                p.payment_status || 'N/A',
                p.team?.team_name || 'N/A',
                payment?.upi_transaction_id || 'N/A',
                payment?.amount ?? (p.payment_status === 'free' ? '0' : 'N/A'),
                earnedPts
            ]);
        });

        ws.addRow([]);
        const volHdr = ws.addRow(['VOLUNTEERS']);
        volHdr.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
        volHdr.alignment = { horizontal: 'center' };
        ws.mergeCells(`A${volHdr.number}:D${volHdr.number}`);
        volHdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF70AD47' } };

        const volCols = ws.addRow(['USN', 'Name', 'Volunteer Status', 'Activity Points Earned']);
        volCols.font = { bold: true };
        volCols.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };

        const volActivityPts = eventData.vol_activity_pts || 0;

        (volunteers || []).forEach(v => {
            const earnedPts = v.volnstatus ? volActivityPts : 0;
            ws.addRow([
                v.volnusn || 'N/A',
                v.student?.sname || 'N/A',
                v.volnstatus ? 'Present' : 'Absent',
                earnedPts
            ]);
        });

        ws.eachRow(row => {
            row.eachCell(cell => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        });

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            `attachment; filename=Event_${eventData.ename.replace(/\s+/g, '_')}_Details.xlsx`
        );

        await workbook.xlsx.write(res);
        res.end();

        console.log(`✅ Excel generated for event ${eventId} by ${userUSN}`);
    } catch (err) {
        console.error('Excel generation error:', err);
        res.status(500).json({ error: 'Error generating Excel file' });
    }
});

// ==================== DYNAMIC QR TOKEN ====================

app.get('/api/sub-events/:seid/qr-token', requireAuth, async (req, res) => {
    try {
        const seid = req.params.seid;
        const userUSN = req.session.userUSN;

        const { data: subEvent, error } = await supabase
            .from('sub_event')
            .select('eid, se_name')
            .eq('seid', seid)
            .limit(1);

        if (error || !subEvent?.length) {
            return res.status(404).json({ error: 'Sub-event not found' });
        }

        const eventId = subEvent[0].eid;

        const { data: event, error: eventError } = await supabase
            .from('event')
            .select('orgusn')
            .eq('eid', eventId)
            .limit(1);

        if (eventError || !event?.length) {
            return res.status(404).json({ error: 'Event not found' });
        }

        if (event[0].orgusn !== userUSN) {
            return res.status(403).json({ error: 'Only the organizer can generate QR tokens' });
        }

        const timestamp = Date.now().toString();
        const payload = `${seid}:${timestamp}`;
        const token = crypto
            .createHmac('sha256', QR_TOKEN_SECRET)
            .update(payload)
            .digest('hex')
            .substring(0, 16);

        res.json({ token, timestamp, seid, eid: eventId, seName: subEvent[0].se_name });
    } catch (err) {
        console.error('QR token generation error:', err);
        res.status(500).json({ error: 'Failed to generate token' });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`📡 CORS enabled for ${process.env.FRONTEND_URL}`);
    console.log(`🔍 Session debugging ENABLED\n`);
    console.log(`🌱 Environment: ${IS_PRODUCTION ? 'production' : 'development'}`);
});

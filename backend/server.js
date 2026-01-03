require('dotenv').config();
const express = require('express');
const path = require('path');
const supabase = require('./lib/supabase');
const session = require('express-session');
const bcrypt = require('bcrypt');
const cors = require('cors');
const crypto = require('crypto');
const ExcelJS = require('exceljs');
const { createClient } = require('redis'); // Import Redis
const Brevo = require('@getbrevo/brevo');

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

// Initialize Redis connection
(async () => {
    try {
        await redisClient.connect();
    } catch (err) {
        console.error('Failed to connect to Redis:', err);
    }
})();

// --- Trust the proxy in production ---
if (IS_PRODUCTION) {
    app.set('trust proxy', 1);
}

// --- Dynamic CORS Origin ---
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['set-cookie']
}));

// Force credentials header for Safari/iOS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Credentials", "true");
  next();
});

app.use(express.json());

// Health check route for UptimeRobot
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// --- Secure Session ---
app.use(session({
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

// Debug middleware to log all requests
app.use((req, res, next) => {
    console.log(`\n📝 ${req.method} ${req.url}`);
    next();
});

// Test Supabase connection
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

// Middleware to check if user is authenticated
function requireAuth(req, res, next) {
    if (req.session.userUSN) {
        next();
    } else {
        console.log('❌ User NOT authenticated - sending 401');
        res.status(401).json({ error: 'Please sign in first' });
    }
}

// --- HELPER: Find lowest available Event ID (Gap Filling) ---
// This logic finds the first missing ID (e.g., if 1, 2, 4 exist, it returns 3)
async function getNextAvailableEventId() {
    try {
        const { data, error } = await supabase
            .from('event')
            .select('eid')
            .order('eid', { ascending: true });

        if (error) throw error;
        if (!data || data.length === 0) return 1;

        for (let i = 0; i < data.length; i++) {
            if (data[i].eid !== i + 1) {
                return i + 1;
            }
        }
        return data.length + 1;
    } catch (err) {
        console.error('Error calculating next ID:', err);
        return null; 
    }
}

// ==================== AUTH ROUTES ====================

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
        
        // Create session
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
        
        // Create session
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

// Get current user info
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

// Sign out endpoint
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

// ==================== EVENT ENDPOINTS (UPDATED) ====================

// --- Create/Organize a new event ---
// Updated to accept posterUrl and bannerUrl, and use the ID gap filler
app.post('/api/events/create', requireAuth, async (req, res) => {
    try {
        const { 
            eventName, eventDescription, certificate_info, eventDate, 
            eventTime, eventLocation, maxParticipants, maxVolunteers, 
            registrationFee, clubId, OrgCid, upiId, isTeamEvent, 
            minTeamSize, maxTeamSize, 
            posterUrl,  // Brochure/Info Link
            bannerUrl   // Visual Image Link
        } = req.body;
        
        const organizedClubId = clubId || OrgCid;
        const fee = parseFloat(registrationFee) || 0;
        
        if (!eventName || !eventDescription || !eventDate || !eventTime || !eventLocation) {
            return res.status(400).json({ error: 'Event name, description, date, time, and location are required' });
        }
        
        if (fee > 0 && (!upiId || upiId.trim() === '')) {
            return res.status(400).json({ error: 'UPI ID is required for paid events' });
        }
        
        const eventDateObj = new Date(eventDate);
        if (eventDateObj <= new Date()) {
            return res.status(400).json({ error: 'Event date must be in the future' });
        }

        if (isTeamEvent) {
            if (!minTeamSize || !maxTeamSize) return res.status(400).json({ error: 'Min/Max team size required' });
            const minSize = parseInt(minTeamSize);
            const maxSize = parseInt(maxTeamSize);
            if (minSize < 2) return res.status(400).json({ error: 'Minimum team size must be at least 2' });
            if (maxSize < minSize) return res.status(400).json({ error: 'Maximum team size must be greater than or equal to minimum team size' });
        }
        
        if (organizedClubId) {
            const { data: clubMembership, error: membershipError } = await supabase
                .from('memberof')
                .select('*')
                .eq('studentusn', req.session.userUSN)
                .eq('clubid', organizedClubId)
                .limit(1);
            
            if (membershipError) return res.status(500).json({ error: 'Database error' });
            if (!clubMembership || clubMembership.length === 0) return res.status(403).json({ error: 'You must be a member of the club' });
        }
        
        // --- ID Calculation ---
        const nextId = await getNextAvailableEventId();
        if (!nextId) return res.status(500).json({ error: 'ID generation failed' });

        // Prepare event data
        const eventData = {
            eid: nextId, // Reuse ID
            ename: eventName,
            eventdesc: eventDescription,
            certificate_info: certificate_info || null,
            poster_url: posterUrl || null, // Info Link
            banner_url: bannerUrl || null, // Visual Link
            eventdate: eventDate,
            eventtime: eventTime,
            eventloc: eventLocation,
            maxpart: maxParticipants || null,
            maxvoln: maxVolunteers || null,
            regfee: fee,
            upi_id: fee > 0 ? upiId : null,
            orgusn: req.session.userUSN,
            orgcid: organizedClubId || null,
            is_team: isTeamEvent || false,
            min_team_size: isTeamEvent ? (parseInt(minTeamSize) || null) : null,
            max_team_size: isTeamEvent ? (parseInt(maxTeamSize) || null) : null
        };

        const { data, error } = await supabase.from('event').insert([eventData]).select('eid');
        
        if (error) {
            console.error('Error creating event:', error);
            return res.status(500).json({ error: error.message });
        }
        
        // Invalidate Cache
        if (redisClient.isOpen) await redisClient.del('events_list_raw');

        res.status(201).json({ 
            success: true,
            message: isTeamEvent ? 'Team event created successfully!' : 'Event created successfully!', 
            eventId: nextId,
            organizerUSN: req.session.userUSN,
            isTeamEvent: isTeamEvent || false
        });
    } catch (err) {
        console.error('Error creating event:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- CACHED Get all events (UPDATED) ---
// Returns poster_url and banner_url
app.get('/api/events', requireAuth, async (req, res) => {
    try {
        const currentDate = new Date().toISOString().split('T')[0];
        const cacheKey = 'events_list_raw';
        let rows = null;

        // 1. Try to get data from Redis cache
        try {
            if (redisClient.isOpen) {
                const cachedData = await redisClient.get(cacheKey);
                if (cachedData) {
                    console.log('⚡ Using Redis Cache for Events');
                    rows = JSON.parse(cachedData);
                }
            }
        } catch (cacheErr) {
            console.error('Redis read error:', cacheErr);
        }

        // 2. If no cache, fetch from Supabase
        if (!rows) {
            console.log('🔍 Fetching Events from Supabase DB');
            const { data, error } = await supabase
                .from('event')
                .select(`
                    eid, ename, eventdesc, eventdate, eventtime, eventloc, maxpart, maxvoln, regfee,
                    upi_id, is_team, min_team_size, max_team_size, poster_url, banner_url,
                    club:orgcid(cname),
                    student:orgusn(sname)
                `);
            
            if (error) {
                console.error('Error fetching events:', error);
                return res.status(500).json({ error: 'Database error' });
            }
            rows = data;

            // 3. Save to Redis Cache
            try {
                if (redisClient.isOpen) {
                    await redisClient.set(cacheKey, JSON.stringify(rows), { EX: 600 });
                }
            } catch (saveErr) {
                console.error('Redis write error:', saveErr);
            }
        }

        // 4. Process data
        const events = {
            ongoing: [],
            completed: [],
            upcoming: []
        };

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
                posterUrl: event.poster_url, // Info Link
                bannerUrl: event.banner_url, // Visual Link
                is_team: event.is_team,
                min_team_size: event.min_team_size,
                max_team_size: event.max_team_size,
                clubName: event.club?.cname,
                organizerName: event.student?.sname
            };
            
            const eventDate = new Date(event.eventdate).toISOString().split('T')[0];
            if (eventDate === currentDate) events.ongoing.push(transformedEvent);
            else if (eventDate < currentDate) events.completed.push(transformedEvent);
            else events.upcoming.push(transformedEvent);
        });

        res.json({
            events,
            currentUser: req.session.userUSN
        });
    } catch (err) {
        console.error('Error fetching events:', err);
        res.status(500).json({ error: 'Error fetching events: ' + err.message });
    }
});

// Get user's participant events only (UPDATED)
app.get('/api/my-participant-events', requireAuth, async (req, res) => {
    try {
        const { data: participantEvents, error } = await supabase
            .from('participant')
            .select(`
                partstatus, partusn,
                event:parteid (
                    eid, ename, eventdesc, certificate_info, eventdate, eventtime, eventloc, maxpart, maxvoln, regfee, poster_url, banner_url,
                    club:orgcid(cname)
                )
            `)
            .eq('partusn', req.session.userUSN);
        
        if (error) {
            console.error('Error fetching participant events:', error);
            return res.status(500).json({ error: 'Database error' });
        }
        
        const transformedEvents = (participantEvents || []).map(p => ({
            ...p.event,
            eventDate: p.event?.eventdate,
            eventTime: p.event?.eventtime,
            eventLoc: p.event?.eventloc,
            maxPart: p.event?.maxpart,
            maxVoln: p.event?.maxvoln,
            regFee: p.event?.regfee,
            posterUrl: p.event?.poster_url,
            bannerUrl: p.event?.banner_url,
            clubName: p.event?.club?.cname,
            PartStatus: p.partstatus==true,
            PartUSN: p.partusn,
            role: 'participant'
        })).filter(e => e.eid);
        
        res.json({
            participantEvents: transformedEvents,
            userUSN: req.session.userUSN
        });
    } catch (err) {
        console.error('Error fetching participant events:', err);
        res.status(500).json({ error: 'Error fetching participant events' });
    }
});

// Get user's volunteer events only
app.get('/api/my-volunteer-events', requireAuth, async (req, res) => {
    try {
        const { data: volunteerEvents, error } = await supabase
            .from('volunteer')
            .select(`
                volnstatus,
                event:volneid (
                    eid, ename, eventdesc, eventdate, eventtime, eventloc, maxpart, maxvoln, regfee,
                    club:orgcid(cname)
                )
            `)
            .eq('volnusn', req.session.userUSN);
        
        if (error) {
            console.error('Error fetching volunteer events:', error);
            return res.status(500).json({ error: 'Database error' });
        }
        
        const transformedEvents = (volunteerEvents || []).map(v => ({
            ...v.event,
            eventDate: v.event?.eventdate,
            eventTime: v.event?.eventtime,
            eventLoc: v.event?.eventloc,
            maxPart: v.event?.maxpart,
            maxVoln: v.event?.maxvoln,
            regFee: v.event?.regfee,
            clubName: v.event?.club?.cname,
            VolnStatus: v.volnstatus==true,
            role: 'volunteer'
        })).filter(e => e.eid);
        
        res.json({
            volunteerEvents: transformedEvents,
            userUSN: req.session.userUSN
        });
    } catch (err) {
        console.error('Error fetching volunteer events:', err);
        res.status(500).json({ error: 'Error fetching volunteer events' });
    }
});

// Get user's organized events only (UPDATED)
app.get('/api/my-organized-events', requireAuth, async (req, res) => {
    try {
        const { data: organizerEvents, error } = await supabase
            .from('event')
            .select(`
                eid, ename, eventdesc, eventdate, eventtime, eventloc, maxpart, maxvoln, regfee,
                upi_id, poster_url, banner_url,
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
            bannerUrl: e.banner_url,
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

// Individual Event Details Route (for organizer ticket page) (UPDATED)
app.get('/api/events/:eventId', requireAuth, async (req, res) => {
    try {
        const eventId = req.params.eventId;
        if (!eventId || isNaN(eventId)) return res.status(400).json({ error: 'Invalid event ID' });

        const { data: rows, error } = await supabase
            .from('event')
            .select(`
                eid, ename, eventdesc, eventdate, eventtime, eventloc, maxpart, maxvoln, regfee, orgusn, poster_url, banner_url,
                club:orgcid(cname),
                student:orgusn(sname)
            `)
            .eq('eid', eventId)
            .limit(1);

        if (error) {
            console.error('Error fetching event details:', error);
            return res.status(500).json({ error: 'Database error' });
        }

        if (!rows || rows.length === 0) return res.status(404).json({ error: 'Event not found' });

        const event = rows[0];
        
        const transformedEvent = {
            ...event,
            eventDate: event.eventdate,
            eventTime: event.eventtime,
            eventLoc: event.eventloc,
            maxPart: event.maxpart,
            maxVoln: event.maxvoln,
            regFee: event.regfee,
            posterUrl: event.poster_url, // Added
            bannerUrl: event.banner_url, // Added
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
        res.status(500).json({ error: 'Error fetching event details: ' + err.message });
    }
});

// Join event as participant (FREE)
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
        
        if (existingError) return res.status(500).json({ error: 'Database error' });
        if (existing && existing.length > 0) return res.status(400).json({ error: 'Already joined this event' });
        
        const { data: event, error: eventError } = await supabase
            .from('event')
            .select('maxpart, regfee')
            .eq('eid', eventId)
            .limit(1);
        
        if (eventError) return res.status(500).json({ error: 'Database error' });
        if (!event || event.length === 0) return res.status(404).json({ error: 'Event not found' });

        if ((event[0].regfee || 0) > 0) {
            return res.status(400).json({ error: 'This is a paid event. Please use the UPI payment flow.', requiresPayment: true });
        }

        if ((event[0].maxpart || 0) > 0) {
            const { count, error: countError } = await supabase.from('participant').select('*', { count: 'exact', head: true }).eq('parteid', eventId);
            if (countError) return res.status(500).json({ error: 'Database error' });
            if (count >= event[0].maxpart) return res.status(400).json({ error: 'No more participant slots available' });
        }
        
        const { error: insertError } = await supabase.from('participant').insert([{ partusn: userUSN, parteid: eventId, partstatus: false, payment_status: 'free' }]);
        if (insertError) return res.status(500).json({ error: 'Database error' });
        
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
        
        if (existingError) return res.status(500).json({ error: 'Database error' });
        if (existing && existing.length > 0) return res.status(400).json({ error: 'Already volunteered for this event'});
        
        const { data: event, error: eventError } = await supabase.from('event').select('maxvoln').eq('eid', eventId).limit(1);
        if (eventError) return res.status(500).json({ error: 'Database error' });
        if (!event || event.length === 0) return res.status(404).json({ error: 'Event not found' });

        if ((event[0].maxvoln || 0) > 0) {
            const { count, error: countError } = await supabase.from('volunteer').select('*', { count: 'exact', head: true }).eq('volneid', eventId);
            if (countError) return res.status(500).json({ error: 'Database error' });
            if (count >= event[0].maxvoln) return res.status(400).json({ error: 'No more volunteer slots available' });
        }
        
        const { error: insertError } = await supabase.from('volunteer').insert([{ volnusn: userUSN, volneid: eventId, volnstatus: false }]);
        if (insertError) return res.status(500).json({ error: 'Database error' });
        
        res.json({ success: true, message: 'Successfully volunteered for event!' });
    } catch (err) {
        console.error('Error volunteering for event:', err);
        res.status(500).json({ error: 'Error volunteering for event' });
    }
});

// Get all clubs
app.get('/api/clubs', requireAuth, async (req, res) => {
    try {
        const { data: rows, error } = await supabase.from('club').select('cid, cname, clubdesc');
        if (error) return res.status(500).json({ error: 'Database error' });
        res.json({ clubs: rows || [], userUSN: req.session.userUSN });
    } catch (err) {
        console.error('Error fetching clubs:', err);
        res.status(500).json({ error: 'Error fetching clubs' });
    }
});

// Get user's clubs
app.get('/api/my-clubs', requireAuth, async (req, res) => {
    try {
        const { data: rows, error } = await supabase.from('memberof').select('club:clubid (cid, cname, clubdesc, maxmembers)').eq('studentusn', req.session.userUSN);
        if (error) return res.status(500).json({ error: 'Database error' });
        const clubs = (rows || []).map(row => row.club).filter(club => club);
        res.json({ clubs: clubs, userUSN: req.session.userUSN });
    } catch (err) {
        console.error('Error fetching user clubs:', err);
        res.status(500).json({ error: 'Error fetching clubs' });
    }
});

// Get all students
app.get('/api/students', requireAuth, async (req, res) => {
    try {
        const { data: rows, error } = await supabase.from('student').select('usn, sname, sem, mobno, emailid');
        if (error) return res.status(500).json({ error: 'Database error' });
        res.json({ students: rows || [], currentUser: req.session.userUSN });
    } catch (err) {
        console.error('Error fetching students:', err);
        res.status(500).json({ error: 'Error fetching students: ' + err.message });
    }
});

// Get volunteer count
app.get('/api/events/:eventId/volunteer-count', requireAuth, async (req, res) => {
    try {
        const { count, error } = await supabase.from('volunteer').select('*', { count: 'exact', head: true }).eq('volneid', req.params.eventId);
        if (error) return res.status(500).json({ error: 'Database error' });
        res.json({ count: count || 0 });
    } catch (err) {
        console.error('Error fetching volunteer count:', err);
        res.status(500).json({ error: 'Error fetching volunteer count' });
    }
});

// Get participant count
app.get('/api/events/:eventId/participant-count', requireAuth, async (req, res) => {
    try {
        const { count, error } = await supabase.from('participant').select('*', { count: 'exact', head: true }).eq('parteid', req.params.eventId);
        if (error) return res.status(500).json({ error: 'Database error' });
        res.json({ count: count || 0 });
    } catch (err) {
        console.error('Error fetching participant count:', err);
        res.status(500).json({ error: 'Error fetching participant count' });
    }
});

// Get participant status
app.get('/api/events/:eventId/participant-status', requireAuth, async (req, res) => {
    try {
        const { data: pCheck } = await supabase.from('participant').select('partstatus, payment_status').eq('partusn', req.session.userUSN).eq('parteid', req.params.eventId).limit(1);
        if (pCheck && pCheck.length > 0) {
            // Re-fetch basic event info to fulfill legacy signature if needed, but returning status is key
             const { data: event } = await supabase.from('event').select('eid, ename, eventdesc, eventdate, eventtime, eventloc, maxpart, maxvoln, regfee, orgusn, poster_url, banner_url, club:orgcid(cname), student:orgusn(sname)').eq('eid', req.params.eventId).limit(1);
             const transformed = { ...event[0], eventDate: event[0].eventdate, eventTime: event[0].eventtime, posterUrl: event[0].poster_url, bannerUrl: event[0].banner_url, clubName: event[0].club?.cname, organizerName: event[0].student?.sname, OrgUsn: event[0].orgusn };
             
            transformed.isRegistered = true;
            transformed.paymentStatus = pCheck[0].payment_status;
            transformed.attendanceMarked = pCheck[0].partstatus;
            return res.json(transformed);
        }
        return res.status(403).json({ error: 'Not registered', isRegistered: false });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==================== ATTENDANCE ====================

app.post('/api/mark-participant-attendance', requireAuth, async (req, res) => {
    try {
        const { eventId, usn } = req.body;
        if (usn !== req.session.userUSN) return res.status(403).json({ error: 'Unauthorized: USN mismatch' });
        if (!usn || !eventId) return res.status(400).json({ error: 'USN and Event ID are required' });

        const { data: existing, error: existingError } = await supabase.from('participant').select('*').eq('partusn', usn).eq('parteid', eventId).limit(1);
        if (existingError) return res.status(500).json({ error: 'Database error' });
        if (!existing || existing.length === 0) return res.status(404).json({ error: 'You are not registered for this event' });
        if (existing[0].partstatus === true) return res.status(400).json({ error: 'Attendance already marked' });

        const { error: updateError } = await supabase.from('participant').update({ partstatus: true }).eq('partusn', usn).eq('parteid', eventId);
        if (updateError) return res.status(500).json({ error: 'Failed to mark attendance' });

        console.log(`✅ Participant attendance marked: ${usn} for event ${eventId}`);
        res.json({ success: true, message: 'Participant attendance marked successfully', usn, eventId });
    } catch (err) {
        console.error('Error marking participant attendance:', err);
        res.status(500).json({ error: 'Error marking attendance: ' + err.message });
    }
});

app.post('/api/mark-volunteer-attendance', requireAuth, async (req, res) => {
    try {
        const { eventId, usn } = req.body;
        if (usn !== req.session.userUSN) return res.status(403).json({ error: 'Unauthorized: USN mismatch' });
        if (!usn || !eventId) return res.status(400).json({ error: 'USN and Event ID are required' });

        const { data: existing, error: existingError } = await supabase.from('volunteer').select('*').eq('volnusn', usn).eq('volneid', eventId).limit(1);
        if (existingError) return res.status(500).json({ error: 'Database error' });
        if (!existing || existing.length === 0) return res.status(404).json({ error: 'You are not registered as a volunteer for this event' });
        if (existing[0].volnstatus === true) return res.status(400).json({ error: 'Attendance already marked' });

        const { error: updateError } = await supabase.from('volunteer').update({ volnstatus: true }).eq('volnusn', usn).eq('volneid', eventId);
        if (updateError) return res.status(500).json({ error: 'Failed to mark attendance' });

        console.log(`✅ Volunteer attendance marked: ${usn} for event ${eventId}`);
        res.json({ success: true, message: 'Volunteer attendance marked successfully', usn, eventId });
    } catch (err) {
        console.error('Error marking volunteer attendance:', err);
        res.status(500).json({ error: 'Error marking attendance: ' + err.message });
    }
});

app.get('/api/scan-qr', async (req, res) => {
    try {
        const { usn, eid } = req.query;
        if (!usn || !eid) return res.status(400).json({ error: 'USN and Event ID are required' });

        const { data: existing, error: existingError } = await supabase.from('participant').select('*').eq('partusn', usn).eq('parteid', eid).limit(1);
        if (existingError) return res.status(500).json({ error: 'Database error' });
        if (!existing || existing.length === 0) return res.status(404).json({ error: 'Participant not found for this event' });
        if (existing[0].partstatus === true) return res.status(400).json({ error: 'Participant already checked in' });

        const { error: updateError } = await supabase.from('participant').update({ partstatus: true }).eq('partusn', usn).eq('parteid', eid);
        if (updateError) return res.status(500).json({ error: 'Database error' });

        res.json({ success: true, message: 'Participant status updated to checked in' });
    } catch (err) {
        console.error('Error updating participant status:', err);
        res.status(500).json({ error: 'Error updating participant status: ' + err.message });
    }
});

// ==================== PASSWORD RESET ====================

app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        const { data: user, error: userError } = await supabase.from('student').select('usn, sname, emailid').eq('emailid', email).limit(1);
        if (userError) return res.status(500).json({ error: 'Database error' });
        if (!user || user.length === 0) return res.json({ success: true, message: 'If an account exists, you will receive a reset link.' });

        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpiry = new Date(Date.now() + 3600000); 

        const { error: updateError } = await supabase.from('student').update({ reset_token: resetToken, reset_token_expiry: resetTokenExpiry.toISOString() }).eq('emailid', email);
        if (updateError) return res.status(500).json({ error: 'Failed to generate link' });

        const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
        
        const sendSmtpEmail = new Brevo.SendSmtpEmail();
        sendSmtpEmail.subject = "Password Reset Request - E-Pass";
        sendSmtpEmail.sender = { "name": "E-Pass System", "email": "flopass333@gmail.com" }; 
        sendSmtpEmail.to = [{ "email": email, "name": user[0].sname }];
        sendSmtpEmail.htmlContent = `<html><body style="font-family: Arial, sans-serif; color: #333;"><div style="max-width: 600px; margin: 0 auto; padding: 20px;"><h2 style="color: #1A2980;">Password Reset</h2><p>Hello <strong>${user[0].sname}</strong>,</p><p>Click below to reset your password:</p><p><a href="${resetLink}" style="background-color: #1A2980; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a></p><p>Or copy this link: <br/>${resetLink}</p><p><i>This link expires in 1 hour.</i></p></div></body></html>`;

        await apiInstance.sendTransacEmail(sendSmtpEmail);
        res.json({ success: true, message: 'If an account exists, you will receive a reset link.' });
    } catch (err) {
        console.error('Error in forgot password:', err);
        res.status(500).json({ error: 'Failed to process request' });
    }
});

app.post('/api/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password are required' });
        if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters long' });
        
        const { data: user, error: userError } = await supabase.from('student').select('usn, sname, emailid, reset_token_expiry').eq('reset_token', token).limit(1);
        if (userError) return res.status(500).json({ error: 'Database error' });
        if (!user || user.length === 0) return res.status(400).json({ error: 'Invalid or expired reset link' });
        
        const tokenExpiry = new Date(user[0].reset_token_expiry);
        if (tokenExpiry < new Date()) return res.status(400).json({ error: 'Reset link has expired. Please request a new one.' });
        
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const { error: updateError } = await supabase.from('student').update({ password: hashedPassword, reset_token: null, reset_token_expiry: null }).eq('reset_token', token);
        if (updateError) return res.status(500).json({ error: 'Failed to reset password' });
        
        res.json({ success: true, message: 'Password reset successfully! You can now sign in with your new password.', userName: user[0].sname });
    } catch (err) {
        console.error('Error in reset password:', err);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

// ==================== TEAMS & PAYMENTS ====================

app.post('/api/events/:eventId/create-team', requireAuth, async (req, res) => {
    try {
        const eventId = req.params.eventId;
        const userUSN = req.session.userUSN;
        const { teamName, memberUSNs } = req.body;

        if (!teamName || !Array.isArray(memberUSNs)) return res.status(400).json({ error: 'Team name and member USNs are required' });

        const { data: event, error: eventError } = await supabase.from('event').select('eid, ename, is_team, min_team_size, max_team_size, regfee').eq('eid', eventId).limit(1);
        if (eventError || !event || event.length === 0) return res.status(404).json({ error: 'Event not found' });
        if (!event[0].is_team) return res.status(400).json({ error: 'This is not a team event' });

        const maxSize = event[0].max_team_size;
        if (maxSize && (memberUSNs.length + 1) > maxSize) return res.status(400).json({ error: `Team size cannot exceed ${maxSize} members (including leader)` });

        const { data: existingTeam } = await supabase.from('team_members').select('team_id, join_status, team:team_id(event_id, leader_usn)').eq('student_usn', userUSN);
        if (existingTeam && existingTeam.length > 0) {
            const joinedTeam = existingTeam.find(tm => tm.join_status === true && tm.team?.event_id === parseInt(eventId));
            if (joinedTeam) return res.status(400).json({ error: 'You have already joined a team for this event. Leave that team first to create a new one.' });
        }

        if (memberUSNs.length > 0) {
            const { data: students, error: studentError } = await supabase.from('student').select('usn, sname').in('usn', memberUSNs);
            if (studentError || !students || students.length !== memberUSNs.length) return res.status(400).json({ error: 'One or more member USNs are invalid' });
            
            const { data: memberTeamCheck } = await supabase.from('team_members').select('student_usn, join_status, team:team_id(event_id)').in('student_usn', memberUSNs).eq('join_status', true);
            if (memberTeamCheck && memberTeamCheck.length > 0) {
                const conflicts = memberTeamCheck.filter(m => m.team?.event_id === parseInt(eventId));
                if (conflicts.length > 0) return res.status(400).json({ error: `Member ${conflicts[0].student_usn} has already joined another team for this event` });
            }
        }

        const { data: teamData, error: teamError } = await supabase.from('team').insert([{ team_name: teamName, leader_usn: userUSN, event_id: eventId, registration_complete: false }]).select('id');
        if (teamError || !teamData || teamData.length === 0) return res.status(500).json({ error: 'Failed to create team' });

        const teamId = teamData[0].id;
        const teamMembersToInsert = [{ team_id: teamId, student_usn: userUSN, join_status: true }];
        memberUSNs.forEach(usn => teamMembersToInsert.push({ team_id: teamId, student_usn: usn, join_status: false }));
        
        const { error: membersError } = await supabase.from('team_members').insert(teamMembersToInsert);
        if (membersError) {
            await supabase.from('team').delete().eq('id', teamId);
            return res.status(500).json({ error: 'Failed to add team members' });
        }

        res.json({ success: true, message: 'Team created successfully! Invitations sent to members.', teamId, minSize: event[0].min_team_size, currentSize: 1, canRegister: event[0].min_team_size <= 1 });
    } catch (err) {
        console.error('Error creating team:', err);
        res.status(500).json({ error: 'Error creating team' });
    }
});

app.post('/api/events/:eventId/join-team', requireAuth, async (req, res) => {
    try {
        const { leaderUSN } = req.body;
        const eventId = req.params.eventId;
        
        if (!leaderUSN) return res.status(400).json({ error: 'Team leader USN is required' });
        
        const { data: existingMembership } = await supabase.from('team_members').select('team_id, team:team_id(event_id, registration_complete)').eq('student_usn', req.session.userUSN);
        if (existingMembership && existingMembership.length > 0) {
            const inEventTeam = existingMembership.find(m => m.team?.event_id === parseInt(eventId));
            if (inEventTeam) {
                if (inEventTeam.team.registration_complete) return res.status(400).json({ error: 'Your team is already registered for this event' });
                return res.status(400).json({ error: 'You are already part of a team for this event' });
            }
        }

        const { data: team } = await supabase.from('team').select('id, team_name, registration_complete').eq('leader_usn', leaderUSN).eq('event_id', eventId).limit(1);
        if (!team || team.length === 0) return res.status(404).json({ error: 'Team not found. Please check the team leader USN.' });
        if (team[0].registration_complete) return res.status(400).json({ error: 'This team has already completed registration' });

        const { data: membership } = await supabase.from('team_members').select('join_status').eq('team_id', team[0].id).eq('student_usn', req.session.userUSN).limit(1);
        if (!membership || membership.length === 0) return res.status(403).json({ error: 'You are not invited to this team' });
        if (membership[0].join_status) return res.status(400).json({ error: 'You have already joined this team' });

        await supabase.from('team_members').update({ join_status: true }).eq('team_id', team[0].id).eq('student_usn', req.session.userUSN);
        res.json({ success: true, message: `Successfully joined team "${team[0].team_name}"!`, teamId: team[0].id });
    } catch (err) {
        console.error('Error joining team:', err);
        res.status(500).json({ error: 'Error joining team' });
    }
});

app.post('/api/events/:eventId/register-team', requireAuth, async (req, res) => {
    try {
        const eventId = req.params.eventId;
        const userUSN = req.session.userUSN;
        
        const { data: team } = await supabase.from('team').select('id, registration_complete, event:event_id(regfee, min_team_size)').eq('leader_usn', userUSN).eq('event_id', eventId).limit(1);
        if (!team || team.length === 0) return res.status(404).json({ error: 'Team not found or you are not the team leader' });
        if (team[0].registration_complete) return res.status(400).json({ error: 'Team is already registered for this event' });

        const teamId = team[0].id;
        const regFee = team[0].event?.regfee || 0;
        const minSize = team[0].event?.min_team_size || 2;
        
        const { data: members } = await supabase.from('team_members').select('student_usn, join_status').eq('team_id', teamId).eq('join_status', true);
        const joinedCount = members?.length || 0;

        if (joinedCount < minSize) return res.status(400).json({ error: `Minimum ${minSize} members must join before registration. Currently ${joinedCount} members have joined.` });
        
        if (regFee > 0) return res.json({ success: true, requiresPayment: true, message: 'Payment required for team registration', teamId, regFee });

        await supabase.from('team').update({ registration_complete: true }).eq('id', teamId);
        const participantsToInsert = members.map(m => ({ partusn: m.student_usn, parteid: eventId, partstatus: false, payment_status: 'free', team_id: teamId }));
        await supabase.from('participant').insert(participantsToInsert);
        res.json({ success: true, message: 'Team registered successfully!', teamId, userUSN });
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

        if (!transaction_id) return res.status(400).json({ error: 'Transaction ID is required' });
        
        const { data: team } = await supabase.from('team').select('id, registration_complete, event:event_id(regfee, min_team_size, maxpart)').eq('leader_usn', userUSN).eq('event_id', eventId).limit(1);
        if (!team || team.length === 0) return res.status(404).json({ error: 'Team not found' });
        if (team[0].registration_complete) return res.status(400).json({ error: 'Team is already registered' });

        const teamId = team[0].id;
        const regFee = team[0].event?.regfee || 0;
        const maxPart = team[0].event?.maxpart || 0;
        
        if (regFee <= 0) return res.status(400).json({ error: 'This is not a paid event' });
        
        const { data: members } = await supabase.from('team_members').select('student_usn').eq('team_id', teamId).eq('join_status', true);
        if (members.length < (team[0].event?.min_team_size || 2)) return res.status(400).json({ error: 'Minimum team size not met' });

        if (maxPart > 0) {
            const { count } = await supabase.from('team').select('*', { count: 'exact', head: true }).eq('event_id', eventId).eq('registration_complete', true);
            if (count >= maxPart) return res.status(400).json({ error: 'Event is full' });
        }

        await supabase.from('payment').insert([{ usn: userUSN, event_id: eventId, amount: regFee, status: 'pending_verification', upi_transaction_id: transaction_id }]);
        await supabase.from('team').update({ registration_complete: true }).eq('id', teamId);
        
        const participantsToInsert = members.map(m => ({ partusn: m.student_usn, parteid: eventId, partstatus: false, payment_status: 'pending_verification', team_id: teamId }));
        await supabase.from('participant').insert(participantsToInsert);
        res.json({ success: true, message: 'Team registration submitted! Payment pending verification.', userUSN });
    } catch (err) {
        console.error('Error registering team with UPI:', err);
        res.status(500).json({ error: 'Error registering team' });
    }
});

app.post('/api/teams/:teamId/add-members', requireAuth, async (req, res) => {
    try {
        const { memberUSNs } = req.body;
        const teamId = req.params.teamId;
        const { data: team } = await supabase.from('team').select('leader_usn, registration_complete, event:event_id(max_team_size)').eq('id', teamId).limit(1);
        if (!team || team.length === 0) return res.status(404).json({ error: 'Team not found' });
        if (team[0].leader_usn !== req.session.userUSN) return res.status(403).json({ error: 'Only leader can add members' });
        if (team[0].registration_complete) return res.status(400).json({ error: 'Cannot add to registered team' });

        const { count: currentSize } = await supabase.from('team_members').select('*', { count: 'exact', head: true }).eq('team_id', teamId);
        if ((currentSize + memberUSNs.length) > team[0].event?.max_team_size) return res.status(400).json({ error: 'Exceeds max team size' });

        const membersToInsert = memberUSNs.map(usn => ({ team_id: teamId, student_usn: usn, join_status: false }));
        await supabase.from('team_members').insert(membersToInsert);
        res.json({ success: true, message: 'Members added!' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/teams/:teamId/confirm-join', requireAuth, async (req, res) => {
    try {
        const teamId = req.params.teamId;
        const { data: membership } = await supabase.from('team_members').select('join_status, team:team_id(event_id, registration_complete, team_name)').eq('team_id', teamId).eq('student_usn', req.session.userUSN).limit(1);
        if (!membership || membership.length === 0) return res.status(404).json({ error: 'Invite not found' });
        if (membership[0].join_status) return res.status(400).json({ error: 'Already joined' });
        if (membership[0].team.registration_complete) return res.status(400).json({ error: 'Team registration closed' });

        await supabase.from('team_members').update({ join_status: true }).eq('team_id', teamId).eq('student_usn', req.session.userUSN);
        res.json({ success: true, message: `Joined ${membership[0].team.team_name}!` });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/events/:eventId/my-invites', requireAuth, async (req, res) => {
    try {
        const { data } = await supabase.from('team_members').select('team_id, join_status, team:team_id(id, team_name, leader_usn, event_id, registration_complete, leader:leader_usn(sname))').eq('student_usn', req.session.userUSN).eq('join_status', false);
        const eventInvites = (data || []).filter(i => i.team?.event_id === parseInt(req.params.eventId)).map(i => ({ teamId: i.team.id, teamName: i.team.team_name, leaderUSN: i.team.leader_usn, leaderName: i.team.leader?.sname, joinStatus: i.join_status, registrationComplete: i.team.registration_complete }));
        res.json({ success: true, invites: eventInvites });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/payments/verify', requireAuth, async (req, res) => {
    try {
        const { participantUSN, eventId } = req.body;
        const organizerUSN = req.session.userUSN;
        const { data: event } = await supabase.from('event').select('orgusn, is_team').eq('eid', eventId).limit(1);
        if (!event || event[0].orgusn !== organizerUSN) return res.status(403).json({ error: 'Unauthorized' });

        await supabase.from('payment').update({ status: 'verified' }).eq('usn', participantUSN).eq('event_id', eventId);
        
        if (event[0].is_team) {
            const { data: team } = await supabase.from('team').select('id').eq('leader_usn', participantUSN).eq('event_id', eventId).limit(1);
            if (team && team.length > 0) {
                const { data: members } = await supabase.from('team_members').select('student_usn').eq('team_id', team[0].id);
                const usns = members.map(m => m.student_usn);
                await supabase.from('participant').update({ payment_status: 'verified' }).in('partusn', usns).eq('parteid', eventId);
                return res.json({ success: true, message: 'Team Verified' });
            }
        }
        await supabase.from('participant').update({ payment_status: 'verified' }).eq('partusn', participantUSN).eq('parteid', eventId);
        res.json({ success: true, message: 'Verified' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/events/:eventId/pending-payments', requireAuth, async (req, res) => {
    try {
        const eventId = req.params.eventId;
        const { data } = await supabase.from('payment').select('*, student:usn(sname)').eq('event_id', eventId).eq('status', 'pending_verification');
        const formatted = data.map(p => ({ partusn: p.usn, studentName: p.student?.sname, amount: p.amount, transactionId: p.upi_transaction_id }));
        res.json({ pendingPayments: formatted });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/events/:eventId/register-upi', requireAuth, async (req, res) => {
    try {
        const { transaction_id } = req.body;
        const { data: event } = await supabase.from('event').select('regfee').eq('eid', req.params.eventId).limit(1);
        await supabase.from('payment').insert([{ usn: req.session.userUSN, event_id: req.params.eventId, amount: event[0].regfee, status: 'pending_verification', upi_transaction_id: transaction_id }]);
        await supabase.from('participant').insert([{ partusn: req.session.userUSN, parteid: req.params.eventId, partstatus: false, payment_status: 'pending_verification' }]);
        res.json({ success: true, message: 'Submitted' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/events/:eventId/generate-details', requireAuth, async (req, res) => {
    try {
        const { data: event } = await supabase.from('event').select('*, student:orgusn(sname)').eq('eid', req.params.eventId).limit(1);
        const { data: participants } = await supabase.from('participant').select('*, student:partusn(sname, sem, mobno, emailid)').eq('parteid', req.params.eventId);
        const workbook = new ExcelJS.Workbook();
        const ws = workbook.addWorksheet('Details');
        ws.addRow(['Event', event[0].ename]);
        ws.addRow(['Date', event[0].eventdate]);
        ws.addRow([]);
        ws.addRow(['USN', 'Name', 'Sem', 'Mobile', 'Status']);
        participants.forEach(p => {
            ws.addRow([p.partusn, p.student.sname, p.student.sem, p.student.mobno, p.partstatus ? 'Present' : 'Absent']);
        });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Event_${req.params.eventId}.xlsx`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
});

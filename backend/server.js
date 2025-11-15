require('dotenv').config();
const express = require('express');
const path = require('path');
const supabase = require('./lib/supabase');
const session = require('express-session');
const bcrypt = require('bcrypt');
const cors = require('cors');
const sgMail = require('@sendgrid/mail');
const crypto = require('crypto');
const ExcelJS = require('exceljs');

const app = express();
const PORT = process.env.PORT || 3000;

// --- PRODUCTION/DEVELOPMENT SETTINGS ---
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

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
        maxAge: 10 * 60 * 1000,
        secure: IS_PRODUCTION ? true : false,  
        sameSite: IS_PRODUCTION ? "none" : "lax",
        path: '/'
    }
}));


// Debug middleware to log all requests
app.use((req, res, next) => {
    console.log(`\n📝 ${req.method} ${req.url}`);
    console.log('📋 Session ID:', req.sessionID);
    console.log('👤 User USN:', req.session.userUSN || 'Not logged in');
    console.log('🍪 Cookies:', req.headers.cookie || 'No cookies');
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

// SendGrid configuration
if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    console.log('✅ SendGrid email configured.');
} else {
    console.error('❌ SENDGRID_API_KEY not found. Email will not work.');
}

// Middleware to check if user is authenticated
function requireAuth(req, res, next) {
    console.log('🔒 Auth check - Session USN:', req.session.userUSN);
    if (req.session.userUSN) {
        console.log('✅ User authenticated:', req.session.userUSN);
        next();
    } else {
        console.log('❌ User NOT authenticated - sending 401');
        res.status(401).json({ error: 'Please sign in first' });
    }
}

// Sign up endpoint
app.post('/api/signup', async (req, res) => {
    try {
        const { name, usn, sem, mobno, email, password } = req.body;
        
        if (!usn || !name || !email || !sem || !mobno || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        if (!/^1BM\d{2}[A-Z]{2}\d{3}$/.test(usn)) {
            return res.status(400).json({ error: 'Invalid USN format' });
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
        
        // Save session explicitly
        req.session.save((err) => {
            if (err) {
                console.error('❌ Session save error:', err);
                return res.status(500).json({ error: 'Session error' });
            }
            console.log('✅ Session created for:', usn);
            console.log('🆔 Session ID:', req.sessionID);
            
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
        
        // Save session explicitly
        req.session.save((err) => {
            if (err) {
                console.error('❌ Session save error:', err);
                return res.status(500).json({ error: 'Session error' });
            }
            console.log('✅ User signed in:', student.usn);
            console.log('🆔 Session ID:', req.sessionID);
            
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

// Get all events
app.get('/api/events', requireAuth, async (req, res) => {
    try {
        const currentDate = new Date().toISOString().split('T')[0];
        
        const { data: rows, error } = await supabase
            .from('event')
            .select(`
                eid, ename, eventdesc, eventdate, eventtime, eventloc, maxpart, maxvoln, regfee,
                upi_id, is_team, min_team_size, max_team_size,
                club:orgcid(cname),
                student:orgusn(sname)
            `);
        
        if (error) {
            console.error('Error fetching events:', error);
            return res.status(500).json({ error: 'Database error' });
        }

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

// Get user's participant events only
app.get('/api/my-participant-events', requireAuth, async (req, res) => {
    try {
        const { data: participantEvents, error } = await supabase
            .from('participant')
            .select(`
                partstatus, partusn,
                event:parteid (
                    eid, ename, eventdesc, eventdate, eventtime, eventloc, maxpart, maxvoln, regfee,
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
            clubName: p.event?.club?.cname,
            PartStatus: p.partstatus,
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
            VolnStatus: v.volnstatus,
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

// Get user's organized events only
app.get('/api/my-organized-events', requireAuth, async (req, res) => {
    try {
        const { data: organizerEvents, error } = await supabase
            .from('event')
            .select(`
                eid, ename, eventdesc, eventdate, eventtime, eventloc, maxpart, maxvoln, regfee,
                upi_id,
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

// Create/Organize a new event
app.post('/api/events/create', requireAuth, async (req, res) => {
    try {
        const { 
            eventName, 
            eventDescription, 
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
            maxTeamSize
        } = req.body;
        
        const organizedClubId = clubId || OrgCid;
        const fee = parseFloat(registrationFee) || 0;
        
        if (!eventName || !eventDescription || !eventDate || !eventTime || !eventLocation) {
            return res.status(400).json({ error: 'Event name, description, date, time, and location are required' });
        }
        
        // UPI Validation
        if (fee > 0 && (!upiId || upiId.trim() === '')) {
            return res.status(400).json({ error: 'UPI ID is required for paid events' });
        }
        
        const eventDateObj = new Date(eventDate);
        const currentDate = new Date();
        if (eventDateObj <= currentDate) {
            return res.status(400).json({ error: 'Event date must be in the future' });
        }

        // Validate team event fields if it's a team event
        if (isTeamEvent) {
            if (!minTeamSize || !maxTeamSize) {
                return res.status(400).json({ 
                    error: 'Minimum and maximum team size are required for team events' 
                });
            }
            
            const minSize = parseInt(minTeamSize);
            const maxSize = parseInt(maxTeamSize);
            
            if (minSize < 2) {
                return res.status(400).json({ 
                    error: 'Minimum team size must be at least 2' 
                });
            }
            
            if (maxSize < minSize) {
                return res.status(400).json({ 
                    error: 'Maximum team size must be greater than or equal to minimum team size' 
                });
            }
        }
        
        if (organizedClubId) {
            const { data: clubMembership, error: membershipError } = await supabase
                .from('memberof')
                .select('*')
                .eq('studentusn', req.session.userUSN)
                .eq('clubid', organizedClubId)
                .limit(1);
            
            if (membershipError) {
                console.error('Error checking club membership:', membershipError);
                return res.status(500).json({ error: 'Database error' });
            }
            
            if (!clubMembership || clubMembership.length === 0) {
                return res.status(403).json({ error: 'You must be a member of the club to organize events for it' });
            }
        }
        
        // Prepare event data
        const eventData = {
            ename: eventName,
            eventdesc: eventDescription,
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

        console.log('Creating event with data:', eventData);
        
        const { data, error } = await supabase
            .from('event')
            .insert([eventData])
            .select('eid');
        
        if (error) {
            console.error('Error creating event:', error);
            return res.status(500).json({ error: `Error creating event: ${error.message}` });
        }
        
        res.status(201).json({ 
            success: true,
            message: isTeamEvent ? 'Team event created successfully!' : 'Event created successfully!', 
            eventId: data[0]?.eid,
            organizerUSN: req.session.userUSN,
            isTeamEvent: isTeamEvent || false
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
        
        // Check event details including regfee
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
        
        // THIS ENDPOINT IS NOW ONLY FOR FREE EVENTS
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
        
        res.json({ success: true, message: 'Successfully joined event!' });
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

// Get volunteer count for an event
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

// Get participant count for an event
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

// Individual Event Details Route (for organizer ticket page)
app.get('/api/events/:eventId', requireAuth, async (req, res) => {
    try {
        const eventId = req.params.eventId;

        if (!eventId || isNaN(eventId)) {
            return res.status(400).json({ error: 'Invalid event ID' });
        }

        const { data: rows, error } = await supabase
            .from('event')
            .select(`
                eid, ename, eventdesc, eventdate, eventtime, eventloc, maxpart, maxvoln, regfee, orgusn,
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
            clubName: event.club?.cname,
            organizerName: event.student?.sname,
            OrgUsn: event.orgusn
        };

        const { data: participantCheck } = await supabase
            .from('participant')
            .select('partstatus')
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

// Get all clubs
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

// Get user's clubs
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

// Get all students
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

// ==================== ATTENDANCE ENDPOINTS ====================

// Mark participant attendance
app.post('/api/mark-participant-attendance', requireAuth, async (req, res) => {
    try {
        const { eventId, usn } = req.body;
        
        // Verify the USN matches the logged-in user
        if (usn !== req.session.userUSN) {
            return res.status(403).json({ error: 'Unauthorized: USN mismatch' });
        }
        
        if (!usn || !eventId) {
            return res.status(400).json({ error: 'USN and Event ID are required' });
        }

        // Check if participant is registered for this event
        const { data: existing, error: existingError } = await supabase
            .from('participant')
            .select('*')
            .eq('partusn', usn)
            .eq('parteid', eventId)
            .limit(1);

        if (existingError) {
            console.error('Error checking participant:', existingError);
            return res.status(500).json({ error: 'Database error' });
        }

        if (!existing || existing.length === 0) {
            return res.status(404).json({ error: 'You are not registered for this event' });
        }

        if (existing[0].partstatus === true) {
            return res.status(400).json({ error: 'Attendance already marked' });
        }

        // Mark attendance
        const { error: updateError } = await supabase
            .from('participant')
            .update({ partstatus: true })
            .eq('partusn', usn)
            .eq('parteid', eventId);
        
        if (updateError) {
            console.error('Error updating participant status:', updateError);
            return res.status(500).json({ error: 'Failed to mark attendance' });
        }

        console.log(`✅ Participant attendance marked: ${usn} for event ${eventId}`);
        res.json({ 
            success: true, 
            message: 'Participant attendance marked successfully',
            usn: usn,
            eventId: eventId
        });
    } catch (err) {
        console.error('Error marking participant attendance:', err);
        res.status(500).json({ error: 'Error marking attendance: ' + err.message });
    }
});

// Mark volunteer attendance
app.post('/api/mark-volunteer-attendance', requireAuth, async (req, res) => {
    try {
        const { eventId, usn } = req.body;
        
        // Verify the USN matches the logged-in user
        if (usn !== req.session.userUSN) {
            return res.status(403).json({ error: 'Unauthorized: USN mismatch' });
        }
        
        if (!usn || !eventId) {
            return res.status(400).json({ error: 'USN and Event ID are required' });
        }

        // Check if volunteer is registered for this event
        const { data: existing, error: existingError } = await supabase
            .from('volunteer')
            .select('*')
            .eq('volnusn', usn)
            .eq('volneid', eventId)
            .limit(1);

        if (existingError) {
            console.error('Error checking volunteer:', existingError);
            return res.status(500).json({ error: 'Database error' });
        }

        if (!existing || existing.length === 0) {
            return res.status(404).json({ error: 'You are not registered as a volunteer for this event' });
        }

        if (existing[0].volnstatus === true) {
            return res.status(400).json({ error: 'Attendance already marked' });
        }

        // Mark attendance
        const { error: updateError } = await supabase
            .from('volunteer')
            .update({ volnstatus: true })
            .eq('volnusn', usn)
            .eq('volneid', eventId);
        
        if (updateError) {
            console.error('Error updating volunteer status:', updateError);
            return res.status(500).json({ error: 'Failed to mark attendance' });
        }

        console.log(`✅ Volunteer attendance marked: ${usn} for event ${eventId}`);
        res.json({ 
            success: true, 
            message: 'Volunteer attendance marked successfully',
            usn: usn,
            eventId: eventId
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

// Forgot Password - Send reset email
app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Check if user exists
        const { data: user, error: userError } = await supabase
            .from('student')
            .select('usn, sname, emailid')
            .eq('emailid', email)
            .limit(1);
        
        if (userError) {
            console.error('Error finding user:', userError);
            return res.status(500).json({ error: 'Database error' });
        }

        // Always return success (don't reveal if email exists for security)
        if (!user || user.length === 0) {
            console.log('Password reset requested for non-existent email:', email);
            return res.json({
                success: true,
                message: 'If an account exists with this email, you will receive a password reset link.'
            });
        }

        // Generate secure reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

        // Save token to database
        const { error: updateError } = await supabase
            .from('student')
            .update({
                reset_token: resetToken,
                reset_token_expiry: resetTokenExpiry.toISOString()
            })
            .eq('emailid', email);
        
        if (updateError) {
            console.error('Error saving reset token:', updateError);
            return res.status(500).json({ error: 'Failed to generate reset link' });
        }

        // Create reset link
        const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
        const fromEmail = process.env.SENDGRID_FROM_EMAIL;

        if (!fromEmail) {
            console.error('❌ SENDGRID_FROM_EMAIL is not set. Cannot send email.');
            return res.status(500).json({ error: 'Email server not configured.' });
        }
        
        // Send email using SendGrid
        const mailOptions = {
            from: `"E-Pass Event System" <${fromEmail}>`,
            to: email,
            subject: 'Password Reset Request - E-Pass',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(to right, #1A2980, #26D0CE); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                        .button { display: inline-block; padding: 15px 30px; background: linear-gradient(to right, #1A2980, #26D0CE); color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
                        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
                        .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>🔒 Password Reset Request</h1>
                        </div>
                        <div class="content">
                            <p>Hello <strong>${user[0].sname}</strong>,</p>
                            <p>We received a request to reset the password for your account associated with <strong>${email}</strong>.</p>
                            <p>Click the button below to reset your password:</p>
                            <center>
                                <a href="${resetLink}" class="button">Reset Password</a>
                            </center>
                            <p>Or copy and paste this link into your browser:</p>
                            <p style="background: #fff; padding: 10px; border: 1px solid #ddd; word-break: break-all;">
                                ${resetLink}
                            </p>
                            <div class="warning">
                                <strong>⚠️ Important:</strong>
                                <ul>
                                    <li>This link will expire in <strong>1 hour</strong></li>
                                    <li>If you didn't request this reset, please ignore this email</li>
                                    <li>Your password won't change until you create a new one</li>
                                </ul>
                            </div>
                            <p>Your USN: <strong>${user[0].usn}</strong></p>
                        </div>
                        <div class="footer">
                            <p>E-Pass Event Management System</p>
                            <p>This is an automated email. Please do not reply.</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };

        await sgMail.send(mailOptions);
        
        console.log('✅ Password reset email sent via SendGrid to:', email);
        res.json({
            success: true,
            message: 'If an account exists with this email, you will receive a password reset link.'
        });

    } catch (err) {
        console.error('Error in forgot password (SendGrid):', err);
        if (err.response) {
            console.error('SendGrid error body:', err.response.body);
        }
        res.status(500).json({ error: 'Failed to process password reset request' });
    }
});

// Reset Password - Update password with token
app.post('/api/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        
        if (!token || !newPassword) {
            return res.status(400).json({ error: 'Token and new password are required' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long' });
        }
        // Find user with valid token
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
        // Check if token is expired
        const tokenExpiry = new Date(user[0].reset_token_expiry);
        if (tokenExpiry < new Date()) {
            return res.status(400).json({ error: 'Reset link has expired. Please request a new one.' });
        }
        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        // Update password and clear reset token
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

// Register for a paid event with UPI
app.post('/api/events/:eventId/register-upi', requireAuth, async (req, res) => {
    try {
        const eventId = req.params.eventId;
        const userUSN = req.session.userUSN;
        const { transaction_id } = req.body;

        if (!transaction_id) {
            return res.status(400).json({ error: 'Transaction ID is required' });
        }

        // Check if already registered
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
        
        // Get event fee
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
        
        // Check participant limit
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

        // Insert payment record
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

        // Insert participant record
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
            message: 'Registration submitted! Your payment is pending verification by the organizer.' 
        });
    } catch (err) {
        console.error('Error in UPI registration:', err);
        res.status(500).json({ error: 'Error submitting registration' });
    }
});

// ==================== PAYMENT VERIFICATION ENDPOINTS (NEW) ====================

// Get pending payments for an event (organizer only)
app.get('/api/events/:eventId/pending-payments', requireAuth, async (req, res) => {
    try {
        const eventId = req.params.eventId;
        const userUSN = req.session.userUSN;

        // Verify organizer
        const { data: event, error: eventError } = await supabase
            .from('event')
            .select('orgusn, ename')
            .eq('eid', eventId)
            .limit(1);

        if (eventError || !event || event.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }

        if (event[0].orgusn !== userUSN) {
            return res.status(403).json({ error: 'Not authorized to view payments for this event' });
        }

        // Get all participants with pending payment status
        const { data: pendingParticipants, error: participantError } = await supabase
            .from('participant')
            .select(`
                partusn,
                payment_status,
                team_id,
                student:partusn (
                    sname,
                    emailid,
                    mobno
                ),
                team:team_id (
                    team_name
                )
            `)
            .eq('parteid', eventId)
            .eq('payment_status', 'pending_verification');

        if (participantError) {
            console.error('Error fetching pending participants:', participantError);
            return res.status(500).json({ error: 'Database error' });
        }

        // Get payment details for each participant
        const paymentsWithDetails = await Promise.all(
            (pendingParticipants || []).map(async (participant) => {
                const { data: paymentData } = await supabase
                    .from('payment')
                    .select('upi_transaction_id, amount, created_at')
                    .eq('usn', participant.partusn)
                    .eq('event_id', eventId)
                    .eq('status', 'pending_verification')
                    .order('created_at', { ascending: false })
                    .limit(1);

                return {
                    partusn: participant.partusn,
                    studentName: participant.student?.sname || 'Unknown',
                    studentEmail: participant.student?.emailid || 'N/A',
                    studentMobile: participant.student?.mobno || 'N/A',
                    transactionId: paymentData?.[0]?.upi_transaction_id || 'N/A',
                    amount: paymentData?.[0]?.amount || 0,
                    submittedAt: paymentData?.[0]?.created_at || null,
                    teamName: participant.team?.team_name || null
                };
            })
        );

        console.log(`✅ Found ${paymentsWithDetails.length} pending payments for event ${eventId}`);
        res.json({
            success: true,
            pendingPayments: paymentsWithDetails
        });
    } catch (err) {
        console.error('Error fetching pending payments:', err);
        res.status(500).json({ error: 'Error fetching pending payments' });
    }
});

// Verify/Approve a payment (organizer only)
app.post('/api/payments/verify', requireAuth, async (req, res) => {
    try {
        const { participantUSN, eventId } = req.body;
        const organizerUSN = req.session.userUSN;

        if (!participantUSN || !eventId) {
            return res.status(400).json({ error: 'Participant USN and Event ID are required' });
        }

        // Verify organizer
        const { data: event, error: eventError } = await supabase
            .from('event')
            .select('orgusn')
            .eq('eid', eventId)
            .limit(1);

        if (eventError || !event || event.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }

        if (event[0].orgusn !== organizerUSN) {
            return res.status(403).json({ error: 'Not authorized to verify payments for this event' });
        }

        // Update payment status in payment table
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

        // Update participant payment status
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
        
        res.json({
            success: true,
            message: 'Payment verified successfully!'
        });
    } catch (err) {
        console.error('Error verifying payment:', err);
        res.status(500).json({ error: 'Error verifying payment' });
    }
});

// Reject a payment (organizer only)
app.post('/api/payments/reject', requireAuth, async (req, res) => {
    try {
        const { participantUSN, eventId, reason } = req.body;
        const organizerUSN = req.session.userUSN;

        if (!participantUSN || !eventId) {
            return res.status(400).json({ error: 'Participant USN and Event ID are required' });
        }

        // Verify organizer
        const { data: event, error: eventError } = await supabase
            .from('event')
            .select('orgusn')
            .eq('eid', eventId)
            .limit(1);

        if (eventError || !event || event.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }

        if (event[0].orgusn !== organizerUSN) {
            return res.status(403).json({ error: 'Not authorized to reject payments for this event' });
        }

        // Update payment status in payment table
        const { error: paymentUpdateError } = await supabase
            .from('payment')
            .update({ 
                status: 'rejected',
                rejection_reason: reason || 'Payment rejected by organizer'
            })
            .eq('usn', participantUSN)
            .eq('event_id', eventId)
            .eq('status', 'pending_verification');

        if (paymentUpdateError) {
            console.error('Error updating payment status:', paymentUpdateError);
            return res.status(500).json({ error: 'Failed to update payment status' });
        }

        // Remove participant from event
        const { error: deleteParticipantError } = await supabase
            .from('participant')
            .delete()
            .eq('partusn', participantUSN)
            .eq('parteid', eventId);

        if (deleteParticipantError) {
            console.error('Error removing participant:', deleteParticipantError);
            return res.status(500).json({ error: 'Failed to remove participant' });
        }

        console.log(`✅ Payment rejected: ${participantUSN} for event ${eventId} by ${organizerUSN}`);
        res.json({
            success: true,
            message: 'Payment rejected and participant removed from event'
        });
    } catch (err) {
        console.error('Error rejecting payment:', err);
        res.status(500).json({ error: 'Error rejecting payment' });
    }
});

// ==================== TEAM EVENTS ENDPOINTS ====================

// Create a team for an event
app.post('/api/events/:eventId/create-team', requireAuth, async (req, res) => {
    try {
        const eventId = req.params.eventId;
        const userUSN = req.session.userUSN;
        const { teamName, memberUSNs } = req.body;

        if (!teamName || !Array.isArray(memberUSNs)) {
            return res.status(400).json({ error: 'Team name and member USNs are required' });
        }

        // Check if event exists and is a team event
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

        // Validate team size (including leader)
        const totalMembers = memberUSNs.length + 1;
        if (maxSize && totalMembers > maxSize) {
            return res.status(400).json({ 
                error: `Team size cannot exceed ${maxSize} members (including leader)` 
            });
        }

        // Check if leader already has a team with join_status = true for this event
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

        // Validate all member USNs exist in student table
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

            // Check if any member has ACTUALLY JOINED another team for this event
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

        // Create team
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

        // Add leader as team member with join_status = true
        const teamMembersToInsert = [{
            team_id: teamId,
            student_usn: userUSN,
            join_status: true
        }];

        // Add other members with join_status = false (pending invites)
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

// Join a team
app.post('/api/events/:eventId/join-team', requireAuth, async (req, res) => {
    try {
        const eventId = req.params.eventId;
        const userUSN = req.session.userUSN;
        const { leaderUSN } = req.body;

        if (!leaderUSN) {
            return res.status(400).json({ error: 'Team leader USN is required' });
        }

        // Check if user is already in any team for this event
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

        // Find the team by leader USN and event ID
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

        // Check if user is in the team members list
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

        // Update join status
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

// Get team status for current user and event
app.get('/api/events/:eventId/team-status', requireAuth, async (req, res) => {
    try {
        const eventId = req.params.eventId;
        const userUSN = req.session.userUSN;

        // Check if event is a team event
        const { data: event } = await supabase
            .from('event')
            .select('is_team, min_team_size, max_team_size, regfee')
            .eq('eid', eventId)
            .limit(1);

        if (!event || event.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }

        if (!event[0].is_team) {
            return res.json({ 
                isTeamEvent: false 
            });
        }

        // Check if user is a team leader for this event
        const { data: leaderTeam } = await supabase
            .from('team')
            .select('id, team_name, registration_complete')
            .eq('leader_usn', userUSN)
            .eq('event_id', eventId)
            .limit(1);

        if (leaderTeam && leaderTeam.length > 0) {
            const teamId = leaderTeam[0].id;

            // Get team members and their join status
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

        // Check if user has ACTUALLY JOINED any team for this event
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

        // User has NO JOINED team
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

// Register team for event (only for team leader) - ONLY FOR FREE EVENTS
app.post('/api/events/:eventId/register-team', requireAuth, async (req, res) => {
    try {
        const eventId = req.params.eventId;
        const userUSN = req.session.userUSN;

        // Check if user is team leader for this event
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

        // Count joined members
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

        // If event has fee, tell frontend to show UPI modal
        if (regFee > 0) {
            return res.json({
                success: true,
                requiresPayment: true,
                message: 'Payment required for team registration',
                teamId,
                regFee
            });
        }

        // For free events, complete registration
        const { error: updateError } = await supabase
            .from('team')
            .update({ registration_complete: true })
            .eq('id', teamId);

        if (updateError) {
            console.error('Error completing team registration:', updateError);
            return res.status(500).json({ error: 'Failed to complete registration' });
        }

        // Add all team members to participant table
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
            teamId
        });
    } catch (err) {
        console.error('Error registering team:', err);
        res.status(500).json({ error: 'Error registering team' });
    }
});

// Register a paid team with UPI
app.post('/api/events/:eventId/register-team-upi', requireAuth, async (req, res) => {
    try {
        const eventId = req.params.eventId;
        const userUSN = req.session.userUSN;
        const { transaction_id } = req.body;

        if (!transaction_id) {
            return res.status(400).json({ error: 'Transaction ID is required' });
        }

        // Check if user is team leader for this event
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

        // Count joined members
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

        // Check event "team" limit
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

        // Insert payment record (for the leader)
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

        // Mark team registration complete
        const { error: updateError } = await supabase
            .from('team')
            .update({ registration_complete: true })
            .eq('id', teamId);

        if (updateError) {
            return res.status(500).json({ error: 'Failed to update team status' });
        }

        // Insert all team members as participants
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
            message: 'Team registration submitted! Your payment is pending verification.'
        });
    } catch (err) {
        console.error('Error registering team with UPI:', err);
        res.status(500).json({ error: 'Error registering team' });
    }
});

// Add team members to existing team
app.post('/api/teams/:teamId/add-members', requireAuth, async (req, res) => {
    try {
        const teamId = req.params.teamId;
        const userUSN = req.session.userUSN;
        const { memberUSNs } = req.body;

        if (!Array.isArray(memberUSNs) || memberUSNs.length === 0) {
            return res.status(400).json({ error: 'Member USNs are required' });
        }

        // Verify user is team leader
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

        // Check current team size
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

        // Validate USNs
        const { data: students } = await supabase
            .from('student')
            .select('usn')
            .in('usn', memberUSNs);

        if (!students || students.length !== memberUSNs.length) {
            return res.status(400).json({ 
                error: 'One or more member USNs are invalid' 
            });
        }

        // Check if members are already in another team for this event
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

        // Add members
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

// Get team invites for current user for a specific event
app.get('/api/events/:eventId/my-invites', requireAuth, async (req, res) => {
    try {
        const eventId = req.params.eventId;
        const userUSN = req.session.userUSN;

        // Find all teams for this event where user is invited
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

        // Filter for this specific event
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

// Confirm join team (accept invite)
app.post('/api/teams/:teamId/confirm-join', requireAuth, async (req, res) => {
    try {
        const teamId = req.params.teamId;
        const userUSN = req.session.userUSN;

        console.log(`Confirming join for user ${userUSN} to team ${teamId}`);

        // Verify user is a member of this team
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

        // Check if user has already joined another team for this event
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

        // Update join status to true
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

        // Verify organizer
        const { data: event, error: eventError } = await supabase
            .from('event')
            .select(`
                eid, ename, eventdate, eventtime, eventloc, orgusn,
                student:orgusn(sname, usn)
            `)
            .eq('eid', eventId)
            .limit(1);

        if (eventError || !event?.[0]) return res.status(404).json({ error: 'Event not found' });
        if (event[0].orgusn !== userUSN) return res.status(403).json({ error: 'Not authorized' });

        const eventData = event[0];

        // Participants (with nested student → payment)
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

        // Volunteers
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

        // Build Excel
        const workbook = new ExcelJS.Workbook();
        const ws = workbook.addWorksheet('Event Details');

        ws.columns = [
            { width: 15 }, { width: 25 }, { width: 10 }, { width: 15 }, { width: 30 },
            { width: 15 }, { width: 20 }, { width: 20 },
            { width: 30 }, { width: 15 }
        ];

        // Event Header
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

        // Participants Section
        ws.addRow([]);
        const partHdr = ws.addRow(['PARTICIPANTS']);
        partHdr.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
        partHdr.alignment = { horizontal: 'center' };
        ws.mergeCells(`A${partHdr.number}:J${partHdr.number}`);
        partHdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };

        const partCols = ws.addRow([
            'USN', 'Name', 'Semester', 'Mobile No', 'Email',
            'Participation Status', 'Payment Status', 'Team Name',
            'UPI Transaction ID', 'Payment Amount'
        ]);
        partCols.font = { bold: true };
        partCols.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };

        (participants || []).forEach(p => {
            const payment = Array.isArray(p.student?.payment) ? 
                p.student.payment.find(pay => pay.upi_transaction_id) : p.student?.payment;
            
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
                payment?.amount ?? (p.payment_status === 'free' ? '0' : 'N/A')
            ]);
        });

        // Volunteers Section
        ws.addRow([]);
        const volHdr = ws.addRow(['VOLUNTEERS']);
        volHdr.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
        volHdr.alignment = { horizontal: 'center' };
        ws.mergeCells(`A${volHdr.number}:C${volHdr.number}`);
        volHdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF70AD47' } };

        const volCols = ws.addRow(['USN', 'Name', 'Volunteer Status']);
        volCols.font = { bold: true };
        volCols.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };

        (volunteers || []).forEach(v => {
            ws.addRow([
                v.volnusn || 'N/A',
                v.student?.sname || 'N/A',
                v.volnstatus ? 'Present' : 'Absent'
            ]);
        });

        // Borders
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

        // Send file
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

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`📡 CORS enabled for ${process.env.FRONTEND_URL}`);
    console.log(`🔍 Session debugging ENABLED\n`);
    console.log(`🌱 Environment: ${IS_PRODUCTION ? 'production' : 'development'}`);
});

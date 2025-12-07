import React, { useEffect, useState, useRef } from 'react';
import './participants.css';
import { useNavigate } from 'react-router-dom';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import DOMPurify from 'dompurify';

const Participants = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState({
    ongoing: [],
    completed: [],
    upcoming: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userInfo, setUserInfo] = useState({ userName: '', userUSN: '' });

  const [generatingIds, setGeneratingIds] = useState(new Set());
  const [downloadLinks, setDownloadLinks] = useState({});

  // --- FAB Visibility Logic ---
  const [showFab, setShowFab] = useState(true);
  const buttonRef = useRef(null);

  // --- Mobile Shader Logic ---
  const canvasRef = useRef(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Detect Mobile Resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // WebGL Shader Effect (Only runs if isMobile is true)
  useEffect(() => {
    if (!isMobile) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl");
    if (!gl) return;

    // --- Vertex Shader ---
    const vsSource = `
      attribute vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    // --- Fragment Shader (Dark Blue Fluid Logic) ---
    const fsSource = `
      precision highp float;
      uniform vec2 u_resolution;
      uniform float u_time;

      // Simplex Noise Function
      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
      float snoise(vec2 v) {
        const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
        vec2 i  = floor(v + dot(v, C.yy) );
        vec2 x0 = v - i + dot(i, C.xx);
        vec2 i1;
        i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod289(i);
        vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
        m = m*m ; m = m*m ;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
        vec3 g;
        g.x  = a0.x  * x0.x  + h.x  * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
      }

      void main() {
        vec2 st = gl_FragCoord.xy / u_resolution.xy;
        st.x *= u_resolution.x / u_resolution.y;
        
        float t = u_time * 0.1; 
        
        float noise1 = snoise(st * 2.0 + t);
        float noise2 = snoise(st * 4.0 - t * 1.5);
        float fluid = smoothstep(-0.2, 0.9, noise1 + noise2 * 0.6);

        // --- DARK BLUE THEME ---
        vec3 deepColor = vec3(0.0, 0.01, 0.05);  
        vec3 midColor  = vec3(0.02, 0.05, 0.15); 
        vec3 lightColor = vec3(0.05, 0.15, 0.4);   

        vec3 color = mix(deepColor, midColor, fluid);
        color = mix(color, lightColor, smoothstep(0.4, 1.0, fluid) * 0.5);
        
        float vig = 1.0 - length(st - 0.5) * 0.5;
        color *= vig;

        gl_FragColor = vec4(color, 1.0);
      }
    `;

    const createShader = (gl, type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Shader Compile Error:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vert = createShader(gl, gl.VERTEX_SHADER, vsSource);
    const frag = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    if (!vert || !frag) return;

    const program = gl.createProgram();
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;

    const positionAttr = gl.getAttribLocation(program, "position");
    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

    const timeLoc = gl.getUniformLocation(program, "u_time");
    const resLoc = gl.getUniformLocation(program, "u_resolution");

    let frameId;
    const startTime = performance.now();

    const render = () => {
      // Ensure canvas exists before trying to access dimensions
      if (!canvas) return;
      
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }

      gl.useProgram(program);
      gl.enableVertexAttribArray(positionAttr);
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
      gl.vertexAttribPointer(positionAttr, 2, gl.FLOAT, false, 0, 0);

      gl.uniform2f(resLoc, canvas.width, canvas.height);
      gl.uniform1f(timeLoc, (performance.now() - startTime) * 0.001);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      frameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(frameId);
  }, [isMobile]); // Re-run effect if view switches to mobile

  // --- End Shader Logic ---

  useEffect(() => {
    fetchUserInfo();
    fetchParticipantEvents();
  }, []);

  // Observer to hide FAB when static button is visible
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowFab(!entry.isIntersecting);
      },
      { root: null, threshold: 0.1 }
    );

    if (buttonRef.current) {
      observer.observe(buttonRef.current);
    }

    return () => {
      if (buttonRef.current) {
        observer.unobserve(buttonRef.current);
      }
    };
  }, [loading]);

  useEffect(() => {
    return () => {
      Object.values(downloadLinks).forEach(link => {
        if (link && link.url) window.URL.revokeObjectURL(link.url);
      });
    };
  }, [downloadLinks]);

  const fetchUserInfo = async () => {
    try {
      const response = await fetch('/api/me', {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.ok) {
        const data = await response.json();
        setUserInfo({ userName: data.userName, userUSN: data.userUSN });
      }
    } catch (err) {
      console.error('Error fetching user info:', err);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  };

  const formatTime = (timeString) => {
    if (!timeString) return 'N/A';
    const [h, m] = timeString.split(':');
    let hours = parseInt(h);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${m} ${ampm}`;
  };

  const categorizeEvents = (eventsList) => {
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    const categorized = { ongoing: [], completed: [], upcoming: [] };

    eventsList.forEach(event => {
      const eventDate = new Date(event.eventDate);
      eventDate.setHours(0, 0, 0, 0);
      const diffTime = eventDate.getTime() - currentDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 0) categorized.ongoing.push(event);
      else if (diffDays < 0) categorized.completed.push(event);
      else categorized.upcoming.push(event);
    });
    return categorized;
  };

  const fetchParticipantEvents = async () => {
    try {
      const response = await fetch('/api/my-participant-events', {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        if (response.status === 401) { navigate('/'); return; }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setEvents(categorizeEvents(data.participantEvents || []));
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const generateCertificate = async (event) => {
    if (downloadLinks[event.eid]?.url) window.URL.revokeObjectURL(downloadLinks[event.eid].url);
    setGeneratingIds(prev => new Set(prev).add(event.eid));
    setDownloadLinks(prev => ({ ...prev, [event.eid]: null }));

    try {
      if (!event.PartStatus) {
        alert('Certificate is only available for attended events.');
        setGeneratingIds(prev => { const next = new Set(prev); next.delete(event.eid); return next; });
        return;
      }
      
      const t = new Date().getTime();
      const existingPdfBytes = await fetch(`/hod_certificate.pdf?v=${t}`).then(res => {
        if (!res.ok) throw new Error('Template not found');
        return res.arrayBuffer();
      });

      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      pdfDoc.registerFontkit(fontkit);
      const page = pdfDoc.getPages()[0];
      const { width } = page.getSize();

      let nameFont;
      try {
        const fontBytes = await fetch(`/Allura-Regular.ttf?v=${t}`).then(r => r.ok ? r.arrayBuffer() : Promise.reject());
        nameFont = await pdfDoc.embedFont(fontBytes);
      } catch { nameFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold); }

      const font = await pdfDoc.embedFont(StandardFonts.Courier);
      
      const nameText = userInfo.userName;
      const nameWidth = nameFont.widthOfTextAtSize(nameText, 38);
      page.drawText(nameText, { x: (width - nameWidth) / 2, y: 250, size: 38, font: nameFont, color: rgb(0.97, 0.85, 0.57) });
      
      page.drawText(userInfo.userUSN, { x: 170, y: 160, size: 19, font, color: rgb(1,1,1) });
      
      const descFont = font; 
      
      const contentText = event.certificate_info || event.eventdesc || event.ename;
      const words = contentText.split(' ');
      
      let line = '', yPos = 225;
      words.forEach(word => {
        const testLine = line + word + ' ';
        if (descFont.widthOfTextAtSize(testLine, 10) > 450 && line !== '') {
          page.drawText(line.trim(), { x: 190, y: yPos, size: 10, font: descFont, color: rgb(1,1,1) });
          line = word + ' '; yPos -= 15;
        } else { line = testLine; }
      });
      if (line) page.drawText(line.trim(), { x: 190, y: yPos, size: 10, font: descFont, color: rgb(1,1,1) });

      const pdfBytes = await pdfDoc.save();
      const url = window.URL.createObjectURL(new Blob([pdfBytes], { type: 'application/pdf' }));
      setDownloadLinks(prev => ({ ...prev, [event.eid]: { url, filename: `Certificate_${event.eid}.pdf` } }));

    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setGeneratingIds(prev => { const next = new Set(prev); next.delete(event.eid); return next; });
    }
  };

  const handleEventButtonClick = (event, type) => {
    if (type === 'completed') generateCertificate(event);
    else navigate(`/participant-ticket?eventId=${event.eid}`);
  };

  const handleParticipateClick = () => navigate('/register-event');
  const handleBack = () => navigate('/events');

  const renderEventsList = (eventsList, eventType) => {
    if (loading) return <div className="event-item"><p>Loading...</p></div>;
    if (error) return <div className="event-item"><p>Error: {error}</p></div>;
    if (!eventsList || eventsList.length === 0) return <div className="event-item"><p>No events available</p></div>;

    return eventsList.map(event => (
      <div className="part-event-item-glass" key={event.eid}>
        <div className="part-event-info">
          <h4>{DOMPurify.sanitize(event.ename || 'N/A')}</h4>
          
          <div className="part-meta-info">
            <span><i className="fas fa-calendar-alt"></i> {formatDate(event.eventDate)}</span>
            <span><i className="fas fa-clock"></i> {formatTime(event.eventTime)}</span>
            <span><i className="fas fa-map-marker-alt"></i> {DOMPurify.sanitize(event.eventLoc || 'N/A')}</span>
          </div>

          <div className="part-status">
              Status: {event.PartStatus ? <span className="status-attended">Attended</span> : <span className="status-reg">Registered</span>}
          </div>
        </div>

        <div className="part-event-actions">
          {eventType === 'completed' ? (
            generatingIds.has(event.eid) ? (
              <button className="part-glass-btn" disabled>Generating...</button>
            ) : downloadLinks[event.eid] ? (
              <a href={downloadLinks[event.eid].url} download={downloadLinks[event.eid].filename} className="part-glass-btn success">
                <i className="fas fa-download"></i> Download
              </a>
            ) : (
              <button className="part-glass-btn primary" onClick={() => handleEventButtonClick(event, eventType)}>
                View Certificate
              </button>
            )
          ) : (
            <button className="part-glass-btn secondary" onClick={() => handleEventButtonClick(event, eventType)}>
              View Ticket
            </button>
          )}
        </div>
      </div>
    ));
  };

  return (
    <div className="participants-page">
      {/* CONDITIONAL BACKGROUND:
        - If Mobile: Show Canvas (Shader)
        - If Desktop: Show original CSS background div
      */}
      {isMobile ? (
        <canvas 
          ref={canvasRef} 
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            width: '100%', 
            height: '100%', 
            zIndex: -1, 
            pointerEvents: 'none' 
          }} 
        />
      ) : (
        <div className="part-bg-layer"></div>
      )}
      
      <div className="part-noise-overlay"></div>

      <div className="logout-container">
        <button id="backBtn" className="logout-btn" onClick={handleBack}>
          <i className="fas fa-arrow-left"></i> Back
        </button>
      </div>

      <section className="hero-section">
        <div className="container">
          
          <div className="card-grid">
            
            <div className="card" id="completed-card">
              <div className="card__background"></div>
              <div className="card__content">
                <h3 className="card__heading">Completed Events</h3>
                <div className="card__details">
                   {renderEventsList(events.completed, 'completed')}
                </div>
              </div>
            </div>

            <div className="card" id="ongoing-card">
              <div className="card__background"></div>
              <div className="card__content">
                <h3 className="card__heading">Ongoing Events</h3>
                <div className="card__details">
                   {renderEventsList(events.ongoing, 'ongoing')}
                </div>
              </div>
            </div>

            <div className="card" id="upcoming-card">
              <div className="card__background"></div>
              <div className="card__content">
                <h3 className="card__heading">Upcoming Events</h3>
                <div className="card__details">
                   {renderEventsList(events.upcoming, 'upcoming')}
                </div>
              </div>
            </div>

          </div>

          {/* STATIC BUTTON - Attached Ref here */}
          <div className="button-container static-action-btn" ref={buttonRef}>
            <button onClick={handleParticipateClick}>
              Participate in other Event
            </button>
          </div>

          {/* MOBILE FAB - Added .hidden class logic */}
          <button 
            className={`mobile-fab ${!showFab ? 'hidden' : ''}`} 
            onClick={handleParticipateClick}
          >
            <i className="fas fa-plus"></i>
            <span>Participate</span>
          </button>

        </div>
      </section>
    </div>
  );
};

export default Participants;

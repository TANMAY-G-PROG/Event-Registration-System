import React, { useEffect, useState, useRef } from 'react';
import { Mail, Linkedin, ArrowRight } from 'lucide-react';
import './Aboutus.css';

// Import your local assets
import member1 from './assets/member1.jpg';
import member2 from './assets/member2.jpg';
import member3 from './assets/member3.jpg';
import member4 from './assets/member4.jpg';

// --- Internal Component: ProfileCard ---
// (Includes the logic to disable tilt on mobile via props)
const ProfileCard = ({ name, title, handle, avatarUrl, onContactClick, enableTilt }) => {
  const cardRef = useRef(null);
  
  const handleMouseMove = (e) => {
    if (!enableTilt || !cardRef.current) return;
    const card = cardRef.current;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const rotateX = ((y - centerY) / centerY) * -10;
    const rotateY = ((x - centerX) / centerX) * 10;
    
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  };

  const handleMouseLeave = () => {
    if (!enableTilt || !cardRef.current) return;
    cardRef.current.style.transform = 'perspective(1000px) rotateX(0) rotateY(0)';
  };

  return (
    <div 
      ref={cardRef}
      className={`profile-card ${enableTilt ? 'desktop-tilt' : ''}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <img src={avatarUrl} alt={name} className="profile-avatar" />
      <h3 className="profile-name">{name}</h3>
      <p className="profile-title">{title}</p>
      <div style={{opacity: 0.7, marginBottom: '15px'}}>@{handle}</div>
      <button className="profile-btn" onClick={onContactClick}>
        Contact <ArrowRight size={16} />
      </button>
    </div>
  );
};

// --- Internal Component: Apple-Style Scroll Reveal ---
const FadeInSection = ({ children, delay = '0s' }) => {
  const [isVisible, setVisible] = useState(false);
  const domRef = useRef();

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    const currentElement = domRef.current;
    if (currentElement) observer.observe(currentElement);

    return () => {
      if (currentElement) observer.unobserve(currentElement);
    };
  }, []);

  return (
    <div
      ref={domRef}
      className={`fade-in-section ${isVisible ? 'is-visible' : ''}`}
      style={{ transitionDelay: delay }}
    >
      {children}
    </div>
  );
};

// --- Main Component ---
const AboutUs = () => {
  const [isMobile, setIsMobile] = useState(false);

  const teamMembers = [
    {
      name: "Tanmay",
      title: "Role/Position",
      handle: "username1",
      status: "Available",
      avatarUrl: member1,
      linkedin: "https://www.instagram.com/suchitkadidal/",
    },
    {
      name: "Suchit",
      title: "Role/Position",
      handle: "username2",
      status: "Available",
      avatarUrl: member2,
      linkedin: "https://www.instagram.com/suchitkadidal/",
    },
    {
      name: "Yashwanth",
      title: "Role/Position",
      handle: "username3",
      status: "Available",
      avatarUrl: member3,
      linkedin: "https://www.instagram.com/suchitkadidal/",
    },
    {
      name: "Member Name 4",
      title: "Role/Position",
      handle: "username4",
      status: "Available",
      avatarUrl: member4,
      linkedin: "https://www.instagram.com/suchitkadidal/",
    },
  ];

  const socialLinks = [
    { name: "Email Us", icon: Mail, url: "mailto:flopass333@gmail.com", isEmail: true },
  ];

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleContactClick = (linkedin) => {
    if (linkedin) window.open(linkedin, "_blank");
  };

  const handleSocialClick = (e, link) => {
    if (link.isEmail) return;
    e.preventDefault();
    window.open(link.url, "_blank");
  };

  return (
    <div className="aboutus-container">
      {/* Hero Section */}
      <section className="aboutus-hero">
        <FadeInSection>
          <div className="hero-content">
            <h1 className="hero-title">About Flo</h1>
            <div className="hero-underline"></div>
            <p className="hero-description">
              Hey there! This is FLO — the place where we finally said "bye-bye" to
              manual forms and "hello" to effortless online passes. We built this
              platform because life's too short to wait in lines.
              <br /><br />
              Smooth design, fast processing, no nonsense. Just vibes + efficiency.
            </p>
          </div>
        </FadeInSection>
      </section>

      {/* Team Section */}
      <section className="team-section">
        <FadeInSection>
          <h2 className="section-title">Meet Our Team</h2>
        </FadeInSection>
        
        <div className="team-grid">
          {teamMembers.map((member, index) => (
            <FadeInSection key={index} delay={isMobile ? '0s' : `${index * 0.1}s`}>
              <div className="card-wrapper">
                <ProfileCard
                  name={member.name}
                  title={member.title}
                  handle={member.handle}
                  avatarUrl={member.avatarUrl}
                  enableTilt={!isMobile} // Disabled on mobile
                  onContactClick={() => handleContactClick(member.linkedin)}
                />
              </div>
            </FadeInSection>
          ))}
        </div>
      </section>

      {/* Connect Section */}
      <section className="connect-section" id="connect-section">
        <FadeInSection>
          <h2 className="connect-title">Connect With Us</h2>
          <div className="social-links">
            {socialLinks.map((link, index) => (
              <a
                key={index}
                href={link.url}
                className="social-link"
                onClick={(e) => handleSocialClick(e, link)}
                rel="noopener noreferrer"
              >
                <link.icon size={24} style={{marginRight: '10px'}} />
                <span>{link.name}</span>
              </a>
            ))}
          </div>
        </FadeInSection>
      </section>
    </div>
  );
};

export default AboutUs;

import React, { useEffect, useState, useRef } from 'react';
import ProfileCard from './ProfileCard';
import './Aboutus.css';

// Import your local assets
import member1 from './assets/member1.jpg';
import member2 from './assets/member2.jpg';
import member3 from './assets/member3.jpg';
import member4 from './assets/member4.jpg';

// --- Reusable "Apple-Style" Scroll Reveal Component ---
const FadeInSection = ({ children, delay = '0s' }) => {
  const [isVisible, setVisible] = useState(false);
  const domRef = useRef();

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        // Trigger when 10% of the element is visible
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

const AboutUs = () => {
  // State to track if the device is mobile
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
    {
      name: "Email Us",
      icon: "fas fa-envelope",
      url: "mailto:flopass333@gmail.com",
      isEmail: true,
    },
  ];

  // Detect mobile screen size to disable heavy logic
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleContactClick = (linkedin) => {
    if (linkedin) {
      window.open(linkedin, "_blank");
    }
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
              platform because life's too short to wait in lines or deal with slow
              processes. With FLO, you can apply, track, and receive approvals
              faster than your chai cools down.
              <br />
              <br />
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
            // On desktop, stagger the fade-in. On mobile, let them fade as they scroll.
            <FadeInSection key={index} delay={isMobile ? '0s' : `${index * 0.1}s`}>
              <div className="card-wrapper">
                <ProfileCard
                  name={member.name}
                  title={member.title}
                  handle={member.handle}
                  status={member.status}
                  contactText="Contact"
                  avatarUrl={member.avatarUrl}
                  showUserInfo={true}
                  // Pass props to disable tilt logic if your component supports it
                  enableTilt={!isMobile}
                  enableMobileTilt={false}
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
                aria-label={link.name}
              >
                <i className={link.icon}></i>
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

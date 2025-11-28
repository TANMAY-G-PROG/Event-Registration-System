import React, { useEffect, useState, useRef } from 'react';
import ProfileCard from './ProfileCard';
import './Aboutus.css';

import member1 from './assets/member1.jpg';
import member2 from './assets/member2.jpg';
import member3 from './assets/member3.jpg';
import member4 from './assets/member4.jpg';

const AboutUs = () => {
  // State to track if the device is mobile
  const [isMobile, setIsMobile] = useState(false);
  
  // Ref for the IntersectionObserver
  const observerRef = useRef(null);

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

  // Detect mobile screen size
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    // Initial check
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // SCROLL REVEAL ANIMATION ENGINE (Mobile Only)
  useEffect(() => {
    // We only run this observer on mobile to prevent conflict with desktop animations
    if (!isMobile) return;

    const observerOptions = {
      root: null,
      rootMargin: '0px',
      threshold: 0.15 // Trigger when 15% of the element is visible
    };

    const observerCallback = (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('reveal-active');
          // Stop observing once revealed so it doesn't animate again
          observerRef.current.unobserve(entry.target);
        }
      });
    };

    observerRef.current = new IntersectionObserver(observerCallback, observerOptions);
    
    // Select all elements we want to animate
    const hiddenElements = document.querySelectorAll('.mobile-reveal');
    hiddenElements.forEach(el => observerRef.current.observe(el));

    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [isMobile]);

  const handleContactClick = (linkedin) => {
    if (linkedin) {
      window.open(linkedin, "_blank");
    } else {
      console.log("LinkedIn link not available");
    }
  };

  const handleSocialClick = (e, link) => {
    if (link.isEmail) {
      return; // Let browser handle mailto: naturally
    }
    e.preventDefault();
    window.open(link.url, "_blank");
  };

  // Smooth scroll to hash on page load
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const element = document.querySelector(hash);
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: "smooth" });
        }, 100);
      }
    }
  }, []);

  return (
    <div className="aboutus-container">
      {/* Hero Section */}
      <section className="aboutus-hero mobile-reveal">
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
      </section>

      {/* Team Section */}
      <section className="team-section">
        <h2 className="section-title mobile-reveal">Meet Our Team</h2>
        <div className="team-grid">
          {teamMembers.map((member, index) => (
            <div 
              key={index} 
              className="card-wrapper mobile-reveal"
              // Add inline delay for staggered effect
              style={{ transitionDelay: isMobile ? `${index * 100}ms` : '0ms' }}
            >
              <ProfileCard
                name={member.name}
                title={member.title}
                handle={member.handle}
                status={member.status}
                contactText="Contact"
                avatarUrl={member.avatarUrl}
                showUserInfo={true}
                // Disable tilt completely on mobile for better scroll performance
                enableTilt={!isMobile}
                enableMobileTilt={false}
                onContactClick={() => handleContactClick(member.linkedin)}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Connect Section */}
      <section className="connect-section" id="connect-section">
        <h2 className="connect-title mobile-reveal">Connect With Us</h2>
        <div className="social-links mobile-reveal">
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
      </section>
    </div>
  );
};

export default AboutUs;

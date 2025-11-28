import React, { useEffect } from 'react';
import ProfileCard from './ProfileCard';
import './Aboutus.css';

import member1 from './assets/member1.jpg';
import member2 from './assets/member2.jpg';
import member3 from './assets/member3.jpg';
import member4 from './assets/member4.jpg';

const AboutUs = () => {
  const teamMembers = [
    {
      name: "Tanmay",
      title: "Developer",
      handle: "@tanmay",
      status: "Available",
      avatarUrl: member1,
      linkedin: "https://www.linkedin.com/in/tanmaya-g-shetty/",
    },
    {
      name: "Suchit",
      title: "Developer",
      handle: "@suchitks",
      status: "Available",
      avatarUrl: member2,
      linkedin: "https://www.linkedin.com/in/suchit-k-s-56a648283",
    },
    {
      name: "Yashwanth",
      title: "Developer",
      handle: "@yashwant",
      status: "Available",
      avatarUrl: member3,
      linkedin: "https://www.instagram.com/suchitkadidal/",
    },
    {
      name: "Suchith N",
      title: "Developer",
      handle: "@suchithn",
      status: "Available",
      avatarUrl: member4,
      linkedin: "https://www.linkedin.com/in/suchithn/",
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
      <section className="aboutus-hero">
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
        <h2 className="section-title">Meet Our Team</h2>
        <div className="team-grid">
          {teamMembers.map((member, index) => (
            <div key={index} className="card-wrapper">
              <ProfileCard
                name={member.name}
                title={member.title}
                handle={member.handle}
                status={member.status}
                contactText="Contact"
                avatarUrl={member.avatarUrl}
                showUserInfo={true}
                enableTilt={true}
                enableMobileTilt={false}
                onContactClick={() => handleContactClick(member.linkedin)}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Connect Section */}
      <section className="connect-section" id="connect-section">
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
      </section>
    </div>
  );
};

export default AboutUs;





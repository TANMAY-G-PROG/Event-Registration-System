import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ProfileCard from './ProfileCard';
import './Aboutus.css';

// import member1 from './assets/member1.jpg';
// import member2 from './assets/member2.jpg';
// import member3 from './assets/member3.jpg';
// import member4 from './assets/member4.jpg';

const AboutUs = () => {
  const navigate = useNavigate();

  const teamMembers = [
    {
      name: "Suchit",
      title: "Developer",
      handle: "suchitks",
      status: "Available",
      avatarUrl: null,
      initials: "SK",
      linkedin: "https://www.linkedin.com/in/suchit-k-s-56a648283",
    },
    {
      name: "Tanmay",
      title: "Developer",
      handle: "tanmay",
      status: "Available",
      avatarUrl: null,
      initials: "TG",
      linkedin: "https://www.linkedin.com/in/tanmaya-g-shetty/",
    },
    {
      name: "Yashwanth",
      title: "Developer",
      handle: "yashwanth",
      status: "Available",
      avatarUrl: null,
      initials: "YH",
      linkedin: "https://www.linkedin.com/in/yashwanth-hv-403ba932b/",
    },
    {
      name: "Suchith N",
      title: "Developer",
      handle: "suchithn",
      status: "Available",
      avatarUrl: null,
      initials: "SN",
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
      return;
    }
    e.preventDefault();
    window.open(link.url, "_blank");
  };

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
    <div className="about-page" style={{ height: '100vh', overflowY: 'scroll' }}>

      {/* Hero Section */}
      <section className="about-hero">
        <div className="about-hero-inner">
          <h1>About Flo</h1>
          <div className="hero-underline"></div>
          <p className="about-hero-desc">
            Hey there! This is FLO — the place where we finally said "bye-bye" to
            manual forms and "hello" to effortless online passes. We built this
            platform because life's too short to wait in lines or deal with slow
            processes. With FLO, you can apply, track, and receive approvals
            faster than your chai cools down.
            <br /><br />
            Smooth design, fast processing, no nonsense. Just vibes + efficiency.
          </p>
        </div>
      </section>

      {/* Team Section */}
      <section className="about-section">
        <h2 className="about-section-title">Meet Our Team</h2>
        <div className="team-grid">
          {teamMembers.map((member, index) => (
            <div key={index} className="card-wrapper profile-card-overrides">
              {/* Initials avatar shown instead of photo */}
              <div style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: '#FFD600',
                border: '2.5px solid #0D0D0D',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: "'DM Mono', monospace",
                fontWeight: 700,
                fontSize: 22,
                color: '#0D0D0D',
                margin: '0 auto 12px',
                letterSpacing: 1,
              }}>
                {member.initials}
              </div>
              <ProfileCard
                name={member.name}
                title={member.title}
                handle={member.handle}
                status={member.status}
                contactText="Contact"
                avatarUrl={null}
                showUserInfo={true}
                enableTilt={false}
                enableMobileTilt={false}
                onContactClick={() => handleContactClick(member.linkedin)}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Connect Section */}
      <section className="about-section" id="connect-section">
        <h2 className="about-section-title">Connect With Us</h2>
        <div className="connect-container">
          <div className="connect-header">Drop us a line</div>
          <div className="connect-body">
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
        </div>
      </section>

    </div>
  );
};

export default AboutUs;

// ... [Imports and LightRays Component remain exactly the same as your code] ...

export default function Events() {
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/me', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        navigate('/');
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      navigate('/');
    }
  };

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/signout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (data.success) {
        navigate('/');
      } else {
        alert('Error logging out. Please try again.');
      }
    } catch (error) {
      console.error('Logout error:', error);
      alert('Error logging out. Please try again.');
    }
  };

  // UPDATED IMAGE STYLE
  const imgStyle = {
    width: '100%',
    height: '100%',
    objectFit: 'contain', // CHANGED: 'cover' -> 'contain' to fit full image
    display: 'block',
    borderTopLeftRadius: '16px',
    borderTopRightRadius: '16px',
    padding: '10px' // Optional: adds a little breathing room inside the frame
  };

  return (
    <div className="events-wrapper">
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css"
      />

      <div className="light-rays-background">
        <LightRays
          raysOrigin="top-center"
          raysColor="#667eea"
          raysSpeed={isMobile ? 1.0 : 1.2}
          lightSpread={isMobile ? 0.5 : 0.6}
          rayLength={isMobile ? 2.0 : 1.5}
          followMouse={true}
          mouseInfluence={isMobile ? 0.2 : 0.15}
          noiseAmount={0.05}
          distortion={0.03}
          fadeDistance={isMobile ? 0.9 : 0.8}
          saturation={isMobile ? 1.4 : 1.2}
        />
      </div>

      <div className="logout-container">
        <button id="logoutBtn" className="logout-btn" onClick={handleLogout}>
          <i className="fas fa-sign-out-alt"></i>
          Logout
        </button>
      </div>

      <section className="cards">
        
        {/* Card 1: Participants Title -> Uses VOLUNTEERS Image */}
        <article className="card card--1" onClick={() => navigate('/participants')}>
          <div className="card__img">
            <img 
              src="https://ik.imagekit.io/flopass/volunteers.png?tr=w-800,h-600,fo-auto" 
              alt="Participants"
              style={imgStyle}
              loading="lazy"
            />
          </div>
          <div className="card__img--hover"></div>
          <div className="card__info">
            <h3 className="card__title">Events participated by you</h3>
            <div className="card__icon">
              <i className="fa-solid fa-plus"></i>
            </div>
          </div>
        </article>

        {/* Card 2: Organisers */}
        <article className="card card--2" onClick={() => navigate('/organisers')}>
          <div className="card__img">
            <img 
              src="https://ik.imagekit.io/flopass/organisers.png?tr=w-800,h-600,fo-auto" 
              alt="Organisers"
              style={imgStyle}
              loading="lazy"
            />
          </div>
          <div className="card__img--hover"></div>
          <div className="card__info">
            <h3 className="card__title">Events organised by you</h3>
            <div className="card__icon">
              <i className="fa-solid fa-plus"></i>
            </div>
          </div>
        </article>

        {/* Card 3: Volunteers Title -> Uses PARTICIPANTS Image */}
        <article className="card card--3" onClick={() => navigate('/volunteers')}>
          <div className="card__img">
            <img 
              src="https://ik.imagekit.io/flopass/participants.png?tr=w-800,h-600,fo-auto" 
              alt="Volunteers"
              style={imgStyle}
              loading="lazy"
            />
          </div>
          <div className="card__img--hover"></div>
          <div className="card__info">
            <h3 className="card__title">Events volunteered by you</h3>
            <div className="card__icon">
              <i className="fa-solid fa-plus"></i>
            </div>
          </div>
        </article>

      </section>
    </div>
  );
}

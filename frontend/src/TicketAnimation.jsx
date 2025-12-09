import React, { useEffect } from 'react';
import './ticket_animation.css';

const TicketAnimation = ({ onClose, eventName, eventDate, userUSN }) => {
  const formattedDate = eventDate 
    ? new Date(eventDate).toLocaleDateString("en-GB", { day: '2-digit', month: '2-digit', year: 'numeric' }) 
    : "DATE TBA";

  useEffect(() => {
    // Automatically close after the 5.8s animation completes
    const timer = setTimeout(() => {
      onClose();
    }, 5800); // 5800ms matches the 5.8s CSS animation duration

    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="ticket-overlay">
      
      {/* Decorative Top (Uiverse output) */}
      <div className="ticket-output">
        <div className="wrap-colors-1"><div className="bg-colors"></div></div>
        <div className="wrap-colors-2"><div className="bg-colors"></div></div>
        <div className="cover"></div>
      </div>

      <div className="area">
        <div className="area-wrapper">
          <div className="ticket-mask">
            <div className="ticket">
              <div className="ticket-flip-container">
                <div className="float">
                  
                  {/* Front Side */}
                  <div className="front">
                    <div className="ticket-body">
                      <div className="reflex"></div>

                      <svg
                        className="icon-cube"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                          <path style={{"--i": 1}} className="path-center" d="M12 12.75L14.25 11.437M12 12.75L9.75 11.437M12 12.75V15" stroke="black" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"></path>
                          <path style={{"--i": 2}} className="path-t" d="M9.75 3.562L12 2.25L14.25 3.563" stroke="black" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"></path>
                          <path style={{"--i": 3}} className="path-tr" d="M21 7.5L18.75 6.187M21 7.5V9.75M21 7.5L18.75 8.813" stroke="black" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"></path>
                          <path style={{"--i": 4}} className="path-br" d="M21 14.25V16.5L18.75 17.813" stroke="black" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"></path>
                          <path style={{"--i": 5}} className="path-b" d="M12 21.75L14.25 20.437M12 21.75V19.5M12 21.75L9.75 20.437" stroke="black" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"></path>
                          <path style={{"--i": 6}} className="path-bl" d="M5.25 17.813L3 16.5V14.25" stroke="black" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"></path>
                          <path style={{"--i": 7}} className="path-tl" d="M3 7.5L5.25 6.187M3 7.5L5.25 8.813M3 7.5V9.75" stroke="black" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"></path>
                      </svg>

                      <header>
                        <div className="ticket-name">
                          <div>
                            <span style={{"--i": 1}}>F</span>
                            <span style={{"--i": 2}}>L</span>
                            <span style={{"--i": 3}}>O</span>
                          </div>
                          <div>
                            <span className="bold" style={{"--i": 4}}>P</span>
                            <span className="bold" style={{"--i": 5}}>A</span>
                            <span className="bold" style={{"--i": 6}}>S</span>
                            <span className="bold" style={{"--i": 7}}>S</span>
                          </div>
                        </div>
                        <div className="ticket-usn">
                          {userUSN || "OPERATIVE"}
                        </div>
                      </header>
                      
                      <div className="ticket-contents">
                        <div className="event">
                          <span className="bold">{eventName}</span>
                          <div>CONFIRMED</div>
                        </div>

                        <div className="number">{formattedDate}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="noise">
        <svg height="100%" width="100%">
          <defs>
            <pattern height="500" width="500" patternUnits="userSpaceOnUse" id="noise-pattern">
              <filter y="0" x="0" id="noise">
                <feTurbulence stitchTiles="stitch" numOctaves="3" baseFrequency="0.65" type="fractalNoise"></feTurbulence>
                <feBlend mode="screen"></feBlend>
              </filter>
              <rect filter="url(#noise)" height="500" width="500"></rect>
            </pattern>
          </defs>
          <rect fill="url(#noise-pattern)" height="100%" width="100%"></rect>
        </svg>
      </div>
    </div>
  );
};

export default TicketAnimation;
"use client"
import { motion } from "framer-motion"
// Removed useNavigate import since the button handling navigation is gone
import "./LandingPage.css"
import Prism from './Prism';
import { useEffect } from "react";

const HeroGeometric = ({
  title1 = "Welcome to",
  title2 = "F l o",
}) => {
  // Removed navigation hook and handleEnter function

  useEffect(() => {
    document.body.style.margin = '0';
    return () => {
      document.body.style.margin = '';
    };
  }, []);

  const fadeUpVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: (i) => ({
      opacity: 1,
      y: 0,
      transition: {
        duration: 1,
        delay: 0.5 + i * 0.2,
        ease: [0.25, 0.4, 0.25, 1],
      },
    }),
  }

  return (
    <div className="hero-geometric-container">
      {/* Prism Background */}
      <div className="hero-prism-background">
        <Prism
          animationType="rotate"
          timeScale={0.5}
          height={3.5}
          baseWidth={5.5}
          scale={3.6}
          hueShift={0}
          colorFrequency={1}
          noise={0.5}
          glow={1}
        />
      </div>
      
      {/* Content */}
      <div className="hero-content-wrapper">
        <div className="hero-content">
          {/* Title */}
          <motion.div custom={0} variants={fadeUpVariants} initial="hidden" animate="visible">
            <h1 className="hero-title">
              <span className="title-part-1">{title1}</span>
              <br />
              <span className="title-part-2">{title2}</span>
            </h1>
          </motion.div>
        </div>
      </div>

      {/* Overlay gradient */}
      <div className="hero-overlay" />
    </div>
  )
}

export default HeroGeometric

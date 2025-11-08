"use client"
import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"
import "./LandingPage.css"
import Prism from './Prism'; // Import the new component

const HeroGeometric = ({
  title1 = "Welcome to",
  title2 = "F l o",
}) => {
  const navigate = useNavigate()

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

  const handleEnter = () => {
    navigate("/login")
  }

  return (
    <div className="hero-geometric-container">
      {/* New Prism Background */}
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

          {/* Enter button */}
          {/* We changed custom={1} back to custom={3} 
            This gives it the original 1.1s delay (0.5 + 3 * 0.2)
          */}
          <motion.div custom={3} variants={fadeUpVariants} initial="hidden" animate="visible" style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
            <button type="button" className="btn" onClick={handleEnter}>
              <strong>ENTER</strong>
              <div id="container-stars">
                <div id="stars"></div>
              </div>

              <div id="glow">
                <div className="circle"></div>
                <div className="circle"></div>
              </div>
            </button>
          </motion.div>
        </div>
      </div>

      {/* Overlay gradient */}
      <div className="hero-overlay" />
    </div>
  )
}

export default HeroGeometric
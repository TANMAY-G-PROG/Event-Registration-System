"use client"
import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"
import "./LandingPage.css"

const HeroGeometric = ({
  title1 = "Welcome to",
  title2 = "FLO.",
}) => {
  const navigate = useNavigate()

  const fadeUp = {
    hidden: { opacity: 0, y: 40 },
    visible: (i) => ({
      opacity: 1, y: 0,
      transition: { duration: 0.6, delay: 0.3 + i * 0.15, ease: [0.25, 0.4, 0.25, 1] }
    }),
  }

  return (
    <div className="landing-page-root">
      <div className="hero-geometric-container">
        <div className="hero-content-wrapper">
          <div className="hero-content">

            <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible">
              <h1 className="hero-title">
                <span className="title-part-1">{title1}</span>
                <span className="title-part-2">{title2}</span>
              </h1>
            </motion.div>

            <motion.div custom={1} variants={fadeUp} initial="hidden" animate="visible">
              <p style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: "12px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.3em",
                color: "rgba(255,255,255,0.45)",
                margin: 0,
                textAlign: "center"
              }}>
                Event Registration System
              </p>
            </motion.div>

            <motion.div custom={2} variants={fadeUp} initial="hidden" animate="visible">
              <button type="button" className="btn" onClick={() => navigate("/login")}>
                <strong>ENTER</strong>
              </button>
            </motion.div>

          </div>
        </div>
      </div>
    </div>
  )
}

export default HeroGeometric

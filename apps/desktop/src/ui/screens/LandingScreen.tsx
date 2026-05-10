import React from 'react';
import { Play, ArrowRight, Cloud, Smartphone, Monitor, Shield, Server, Key, Layout, Users, FileText, Calendar, Lock, CheckCircle, BookOpen } from 'lucide-react';

interface LandingScreenProps {
  onStart: () => void;
}

export const LandingScreen: React.FC<LandingScreenProps> = ({ onStart }) => {
  return (
    <div className="landing-container">
      {/* NAVBAR */}
      <nav className="landing-navbar">
        <div className="landing-nav-left">
          <div className="landing-logo">
            <span className="landing-logo-text">Briefly</span>
          </div>
          <div className="landing-nav-links">
            <a href="#hero">Inicio</a>
            <a href="#features">Funciones</a>
            <a href="#mobile">Mobile</a>
            <a href="#security">Seguridad</a>
            <a href="#footer">Equipo</a>
          </div>
        </div>
        <div className="landing-nav-right">
          <button className="landing-btn-outline" onClick={onStart}>
            Iniciar sesión
          </button>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section id="hero" className="landing-hero">
        <div className="landing-hero-content">
          <h1 className="landing-hero-title">Una ruta clara<br />para estudiar mejor.</h1>
          <p className="landing-hero-subtitle">
            Briefly conecta tus grupos, hojas, tareas y calendario en una experiencia web y móvil.
          </p>
          <div className="landing-hero-actions">
            <button className="landing-btn-primary" onClick={onStart}>
              Probar ahora <ArrowRight size={18} />
            </button>
            <a href="#how-it-works" className="landing-btn-secondary">
              Ver demo <Play size={18} />
            </a>
          </div>
          <div className="landing-hero-badges">
            <span className="landing-badge"><Cloud size={14} /> Cloud-first</span>
            <span className="landing-badge"><Smartphone size={14} /> APK Android</span>
            <span className="landing-badge"><Monitor size={14} /> Web + Mobile</span>
          </div>
        </div>
        
        {/* HERO VISUAL - real device mockups */}
        <div className="landing-hero-visuals">
          <img src="/landing/device-mockups.png" alt="" className="hero-devices-img" />
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="landing-section">
        <div className="landing-section-header">
          <h2 className="landing-section-title">Cómo funciona</h2>
          <div className="title-underline"></div>
        </div>
        <div className="landing-steps-container">
          <div className="landing-step-line"></div>
          <div className="landing-grid-3 relative-z">
            <div className="landing-feature-card">
              <div className="landing-feature-icon-lg">
                <Users size={32} />
                <div className="icon-plus">+</div>
              </div>
              <h3>1. Crea un grupo</h3>
              <p>Invita a tus compañeros y crea espacios de estudio privados en segundos.</p>
              <div className="card-illustration">
                <img src="/landing/how-it-works-1.png" alt="" className="hiw-img" />
              </div>
            </div>
            <div className="landing-feature-card">
              <div className="landing-feature-icon-lg">
                <CheckCircle size={32} />
              </div>
              <h3>2. Organiza hojas y tareas</h3>
              <p>Comparte hojas, asigna tareas y define fechas para mantener todo en orden.</p>
              <div className="card-illustration">
                <img src="/landing/how-it-works-2.png" alt="" className="hiw-img" />
              </div>
            </div>
            <div className="landing-feature-card">
              <div className="landing-feature-icon-lg">
                <Smartphone size={32} />
              </div>
              <h3>3. Continúa desde web o móvil</h3>
              <p>Tu información siempre sincronizada. Continúa donde lo dejaste.</p>
              <div className="card-illustration">
                 <img src="/landing/how-it-works-3.png" alt="" className="hiw-img" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ALL CONNECTED */}
      <section className="landing-section">
        <div className="landing-connected-wrapper">
          <div className="landing-connected-content">
            <span className="landing-section-overline">TODO CONECTADO</span>
            <h2 className="landing-section-title" style={{textAlign: 'left'}}>Tus espacios se sincronizan entre dispositivos.</h2>
            <p className="landing-section-desc" style={{margin: 0, textAlign: 'left'}}>Lo que creas en la web, lo tienes en tu móvil. Sincronización en tiempo real para que nada se quede atrás.</p>
            
            <div className="landing-dotted-path">
              <svg width="250" height="120" viewBox="0 0 250 120">
                <path d="M0,100 C80,100 120,20 250,20" fill="none" stroke="#d5cebc" strokeWidth="2" strokeDasharray="6 6" />
                {/* little tree detailed */}
                <g transform="translate(30, 95)">
                  <path d="M0,0 L5,-15 L10,0 Z" fill="#777" />
                  <path d="M2,-5 L5,-20 L8,-5 Z" fill="#555" />
                  <rect x="4" y="0" width="2" height="5" fill="#8b7355" />
                </g>
              </svg>
            </div>
          </div>
          <div className="landing-connected-visual">
             <div className="lc-laptop">
               <div className="lc-screen">
                 <div className="lc-header">
                   <div className="lc-header-left">
                     <div className="lc-icon-box"><BookOpen size={14} color="#a78bfa" /></div>
                     <span>Cálculo Diferencial</span>
                   </div>
                   <div className="lc-header-right">
                     <span className="lc-pill">Syncing...</span>
                   </div>
                 </div>
                 <div className="lc-tabs">
                   <span className="active">Resumen</span>
                   <span>Hojas</span>
                   <span>Tareas</span>
                   <span>Miembros</span>
                 </div>
                 <div className="lc-list-header">
                   <span className="lh-name">Nombre</span>
                   <span className="lh-pages">Páginas</span>
                   <span className="lh-date">Actualizado</span>
                 </div>
                 <div className="lc-list">
                   <div className="lc-item">
                     <span className="li-name"><FileText size={12}/> Límites y continuidad</span>
                     <span className="li-pages">15</span>
                     <span className="li-date">10h 2m</span>
                   </div>
                   <div className="lc-item">
                     <span className="li-name"><FileText size={12}/> Derivadas e interpretaciones</span>
                     <span className="li-pages">8</span>
                     <span className="li-date">10h 5m</span>
                   </div>
                   <div className="lc-item">
                     <span className="li-name"><FileText size={12}/> Reglas de derivación</span>
                     <span className="li-pages">12</span>
                     <span className="li-date">10h 12m</span>
                   </div>
                 </div>
               </div>
             </div>
             <div className="lc-mobile">
               <div className="lc-mobile-screen">
                 <div className="lc-m-header">
                   <div className="lc-icon-box-sm"><BookOpen size={10} color="#a78bfa" /></div>
                   <span>Cálculo Diferencial</span>
                 </div>
                 <div className="lc-m-tabs"><span className="active">Resumen</span><span>Hojas</span></div>
                 <div className="lc-m-list">
                   <div className="lc-m-item"><FileText size={10}/> Límites y...</div>
                   <div className="lc-m-item"><FileText size={10}/> Derivadas...</div>
                   <div className="lc-m-item"><FileText size={10}/> Reglas...</div>
                 </div>
               </div>
               <div className="lc-sync-badge">
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21v-5h5"/></svg>
               </div>
             </div>
          </div>
        </div>
      </section>

      {/* MAIN FEATURES */}
      <section id="features" className="landing-section">
        <div className="landing-features-wrapper">
          <div className="landing-features-grid-container">
            <span className="landing-section-overline">FUNCIONES PRINCIPALES</span>
            <h2 className="landing-section-title" style={{textAlign: 'left', marginBottom: 40}}>Todo lo que necesitas,<br/>en un solo lugar.</h2>
            
            <div className="landing-grid-2x3">
              <div className="landing-card-alt">
                <div className="landing-card-icon-container">
                  <Users size={24} color="#7c5cbf" />
                </div>
                <h3>Grupos de estudio</h3>
                <p>Crea grupos cerrados, invita compañeros y colabora de forma organizada.</p>
              </div>
              <div className="landing-card-alt">
                <div className="landing-card-icon-container">
                  <FileText size={24} color="#7c5cbf" />
                </div>
                <h3>Hojas compartidas</h3>
                <p>Comparte apuntes, documentos y recursos con tu grupo en un mismo espacio.</p>
              </div>
              <div className="landing-card-alt">
                <div className="landing-card-icon-container">
                  <Calendar size={24} color="#7c5cbf" />
                </div>
                <h3>Tareas y calendario</h3>
                <p>Asigna tareas, establece fechas y visualiza todo en tu calendario integrado.</p>
              </div>
              <div className="landing-card-alt">
                <div className="landing-card-icon-container">
                  <Cloud size={24} color="#7c5cbf" />
                </div>
                <h3>Sincronización cloud</h3>
                <p>Tus datos siempre disponibles y actualizados entre web y móvil.</p>
              </div>
              <div className="landing-card-alt">
                <div className="landing-card-icon-container">
                  <Smartphone size={24} color="#7c5cbf" />
                </div>
                <h3>APK standalone</h3>
                <p>Usa Briefly en Android sin necesidad de Google Play. Ligero y seguro.</p>
              </div>
              <div className="landing-card-alt">
                <div className="landing-card-icon-container">
                  <Shield size={24} color="#7c5cbf" />
                </div>
                <h3>Seguridad con JWT y HTTPS</h3>
                <p>Autenticación segura y conexión protegida en todo momento.</p>
              </div>
            </div>
          </div>
          <div className="landing-features-art">
             <img src="/landing/features-cliff.png" alt="" className="features-cliff-img" />
          </div>
        </div>
      </section>

      {/* EDITORIAL - DESIGNED FOR STUDENTS */}
      <section className="landing-section">
        <div className="landing-section-editorial-rich">
          {/* Subtle transition decoration */}
          <svg className="editorial-transition-deco" viewBox="0 0 80 120" width="80" height="120" aria-hidden="true">
            <path d="M40,120 C40,100 50,80 40,60 C30,40 45,20 40,0" fill="none" stroke="#d5cebc" strokeWidth="8" strokeLinecap="round" />
            <path d="M40,120 C40,100 50,80 40,60 C30,40 45,20 40,0" fill="none" stroke="#fdfcf8" strokeWidth="6" strokeLinecap="round" />
            <circle cx="40" cy="20" r="5" fill="#c4bfae" />
            <circle cx="45" cy="60" r="3" fill="#d5cebc" />
          </svg>

          <div className="editorial-illustration">
             <img src="/landing/student-illustration.png" alt="" className="student-illustration-img" />
          </div>
          <div className="editorial-content">
            <span className="landing-section-overline">DISEÑADO PARA ESTUDIANTES</span>
            <h2 className="landing-editorial-title">Briefly reduce el desorden entre apuntes, pendientes y colaboración.</h2>
            <p className="landing-editorial-subtitle">Menos caos, más enfoque. Dedica tu energía a aprender, no a buscar información.</p>
            <div className="landing-editorial-stats">
              <div className="landing-stat">
                <div className="landing-stat-icon"><Layout size={20} /></div>
                <p>Enfócate en lo importante</p>
              </div>
              <div className="landing-stat-line"></div>
              <div className="landing-stat">
                <div className="landing-stat-icon"><Play size={20} /></div>
                <p>Menos distracciones, más productividad</p>
              </div>
              <div className="landing-stat-line"></div>
              <div className="landing-stat">
                <div className="landing-stat-icon"><Users size={20} /></div>
                <p>Colabora con tu equipo fácilmente</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECURITY AND AVAILABILITY */}
      <section id="security" className="landing-section-dark">
        <div className="landing-section">
          <div className="landing-section-header">
            <span className="landing-section-overline" style={{color: '#a78bfa'}}>SEGURIDAD Y DISPONIBILIDAD</span>
            <h2 className="landing-section-title">Tu información está protegida<br/>y siempre disponible.</h2>
            <p className="landing-section-desc">Infraestructura moderna, protocolos seguros y arquitectura escalable para que estudies con tranquilidad.</p>
          </div>
          <div className="landing-security-grid">
            <div className="landing-security-item">
              <Lock size={32} />
              <h4>HTTPS</h4>
              <p>Conexiones cifradas para proteger tus datos en tránsito.</p>
            </div>
            <div className="landing-security-item">
              <Key size={32} />
              <h4>JWT</h4>
              <p>Autenticación segura con tokens para acceso confiable.</p>
            </div>
            <div className="landing-security-item">
              <Server size={32} />
              <h4>AWS EC2</h4>
              <p>Servidores en la nube escalables y de alta disponibilidad.</p>
            </div>
            <div className="landing-security-item">
              <div className="security-icon-n">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
              </div>
              <h4>NGINX</h4>
              <p>Reverse proxy para rendimiento, seguridad y balanceo.</p>
            </div>
            <div className="landing-security-item">
              <Cloud size={32} />
              <h4>Datos centralizados en servicios cloud</h4>
              <p>Respaldo y redundancia para que nada se pierda.</p>
            </div>
          </div>
        </div>
        
        {/* Mountain decoration at bottom of dark section */}
        <img src="/landing/security-mountains.png" alt="" className="security-mountains-img" />
      </section>

      {/* CTA FINAL */}
      <section id="mobile" className="landing-section-cta">
        <div className="landing-cta-inner">
          <div className="landing-cta-content">
            <span className="landing-section-overline" style={{color: '#7c5cbf'}}>DISPONIBLE EN WEB Y ANDROID</span>
            <h2 className="landing-section-title" style={{color: '#111'}}>Lleva Briefly a todas partes.</h2>
            <p className="landing-section-desc" style={{color: '#555', marginBottom: 32}}>Accede desde tu navegador o desde tu Android.<br/>La misma experiencia, siempre contigo.</p>
            <div className="landing-cta-actions">
              <button className="landing-btn-primary" onClick={onStart}>
                <Monitor size={18} /> Abrir web
              </button>
              {/* TODO: replace with GitHub Releases APK URL before production release */}
              <a href="/downloads/briefly.apk" download className="landing-btn-secondary">
                <Smartphone size={18} /> Descargar APK
              </a>
              <a href="https://github.com/JhovaYu/Briefly_Cloud_First_Always_Online.git" target="_blank" rel="noreferrer" className="landing-btn-outline cta-github-btn">
                <img src="/github-mark.svg" alt="" width="18" onError={(e) => e.currentTarget.style.display='none'} /> Ver repositorio
              </a>
            </div>
          </div>
          <div className="cta-device-bg"></div>
          <div className="landing-cta-visual">
             <img src="/landing/cta-devices.png" alt="" className="cta-devices-img" />
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer id="footer" className="landing-footer">
        <div className="landing-footer-top">
          <div className="landing-footer-brand">
            <div className="landing-logo">
              <span className="landing-logo-text">Briefly</span>
            </div>
            <p>Plataforma de colaboración<br/>para grupos de estudio.<br/>Hecha para estudiantes.</p>
          </div>
            <div className="landing-footer-col">
              <h4>Producto</h4>
              <a href="#hero">Inicio</a>
              <a href="#features">Funciones</a>
              <a href="#mobile">Mobile</a>
              <a href="#security">Seguridad</a>
            </div>
            <div className="landing-footer-col">
              <h4>Recursos</h4>
              <a href="#">Documentación</a>
              <a href="https://github.com/JhovaYu/Briefly_Cloud_First_Always_Online.git">Repositorio</a>
              <a href="#">Reportar un issue</a>
              <a href="#">Roadmap</a>
            </div>
            <div className="landing-footer-col">
              <h4>Proyecto Académico</h4>
              <span>Universidad Autónoma<br/>de Chiapas</span>
              <span>Taller de Desarrollo 4</span>
              <img src="/unach-logo.png" alt="UNACH" width="80" style={{marginTop: '16px', opacity: 0.8}} onError={(e) => e.currentTarget.style.display='none'} />
            </div>
            <div className="landing-footer-col">
              <h4>Equipo</h4>
              <span>David Levet Ramírez</span>
              <span>Elmar Enrique Maldonado de paz</span>
              <span>Isaac Hernández Molina</span>
              <span>Alfredo Emiliano Pinto Velasco</span>
              <span>Jhovanny Yuca Hernández</span>
            </div>
        </div>
        <div className="landing-footer-bottom">
          <p>© 2026 Briefly. Todos los derechos reservados.</p>
          <span>briefly.ddns.net</span>
        </div>
      </footer>
    </div>
  );
};

import { useState } from 'react';
import { ArrowLeft, Copy, Zap } from 'lucide-react';
import { SeedPhrase, IdentityManager } from '@tuxnotas/shared';
import { type UserProfile, saveUserProfile } from '../../core/domain/UserProfile';

export function ProfileSetup({ onComplete }: { onComplete: (profile: UserProfile) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [advancedMode, setAdvancedMode] = useState<'none' | 'seed-login' | 'seed-generate' | 'onboarding'>('none');
  
  // States (Register / Common)
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // State para Seed
  const [seedInput, setSeedInput] = useState('');
  const [generatedSeed, setGeneratedSeed] = useState('');
  
  // Perfil secundario: Color
  const [color, setColor] = useState('#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'));

  // Estado de carga y error para la Nube
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleFinishOnboarding = (identityType: 'cloud' | 'seed' | 'local', uid: string, seedStr?: string, syncPoolStr?: string) => {
    let finalName = username.trim() || fullName.trim();
    if (!finalName && identityType === 'seed') finalName = "P2P User";

    const profile: UserProfile = {
      id: uid || Math.random().toString(36).substr(2, 9),
      name: finalName,
      color,
      createdAt: Date.now(),
      identityType,
      seedPhrase: seedStr || undefined,
      syncPoolId: syncPoolStr || undefined
    };
    
    saveUserProfile(profile);
    onComplete(profile);
  };

  const colors = ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c', '#3498db', '#9b59b6', '#e91e63', '#795548', '#607d8b'];

  return (
    <div className="login-screen">
      <div className="login-left-panel">
        <h1>Plasma tus ideas.<br/><span>Todo en un solo<br/>lugar.</span></h1>
        <p>Una plataforma de notas y organización hecha por estudiantes, para estudiantes.</p>
        <img src="./logo.png" className="login-left-logo fade-in" alt="Briefly Logo" style={{ marginTop: 60, width: 140, objectFit: 'contain' }} />
      </div>

      <div className="login-right-panel">
        <div className="login-card fade-in">
          
          {advancedMode === 'none' && (
             <>
                <h2>{mode === 'login' ? 'Iniciar sesión' : 'Crear una cuenta'}</h2>
                <p className="login-subtitle">{mode === 'login' ? 'Continúa donde lo dejaste' : 'Únete a Briefly de forma gratuita'}</p>
                
                <button className="auth-google-btn" onClick={async () => {
                   const sb = IdentityManager.cloudClient;
                   if (sb) {
                       await sb.auth.signInWithOAuth({ provider: 'google' });
                   }
                }}>
                  <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/></svg>
                  {mode === 'login' ? 'Iniciar sesión con Google' : 'Crear cuenta con Google'}
                </button>

                <div className="login-divider"><span>o</span></div>

                {mode === 'register' && (
                  <>
                    <label className="auth-input-label">Nombre completo</label>
                    <input className="login-input" style={{width: '100%'}} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Ej. Jhovanny Yuca"/>
                    <label className="auth-input-label">Nombre de usuario</label>
                    <input className="login-input" style={{width: '100%'}} value={username} onChange={e => setUsername(e.target.value)} placeholder="@ jhovayu22"/>
                  </>
                )}

                <label className="auth-input-label">{mode === 'login' ? 'Email o Nombre de usuario' : 'Email'}</label>
                <input className="login-input" style={{width: '100%'}} value={email} onChange={e => setEmail(e.target.value)} placeholder="name@briefly.io"/>

                <label className="auth-input-label">Contraseña</label>
                <input className="login-input" type="password" style={{width: '100%'}} value={password} onChange={e => { setPassword(e.target.value); setErrorMsg(''); }} placeholder="••••••••"/>

                {mode === 'register' && (
                  <>
                    <label className="auth-input-label">Confirmar contraseña</label>
                    <input className="login-input" type="password" style={{width: '100%'}} value={confirmPassword} onChange={e => { setConfirmPassword(e.target.value); setErrorMsg(''); }} placeholder="••••••••"/>
                  </>
                )}

                {errorMsg && <p style={{ color: '#ff4c4c', fontSize: 13, marginTop: 12, textAlign: 'center', width: '100%' }}>{errorMsg}</p>}

                <button className="login-btn-primary glow" disabled={loading} onClick={async () => {
                   const sb = IdentityManager.cloudClient;
                   if (!sb) {
                       setErrorMsg("Falta configurar la URL y llave de Supabase en el .env");
                       return;
                   }
                   
                   setLoading(true);
                   setErrorMsg('');

                   try {
                       if (mode === 'register') {
                           if (password !== confirmPassword) {
                               throw new Error("Las contraseñas no coinciden.");
                           }
                           if (!email || !password || !fullName || !username) {
                               throw new Error("Por favor, llena todos los campos.");
                           }
                           const { data, error: err } = await sb.auth.signUp({
                               email,
                               password,
                               options: { data: { full_name: fullName, username } }
                           });
                           if (err) throw err;
                           if (data.user) handleFinishOnboarding('cloud', data.user.id);
                       } else {
                           if (!email || !password) throw new Error("Ingresa correo y contraseña.");
                           const { data, error: err } = await sb.auth.signInWithPassword({
                               email,
                               password
                           });
                           if (err) throw err;
                           if (data.user) {
                               const profileName = data.user.user_metadata?.username || data.user.user_metadata?.full_name || email.split('@')[0];
                               setUsername(profileName);
                               handleFinishOnboarding('cloud', data.user.id);
                           }
                       }
                   } catch (err: any) {
                       console.error(err);
                       setErrorMsg(err.message || "Ocurrió un error al autenticarse.");
                   } finally {
                       setLoading(false);
                   }
                }}>
                  {loading ? 'Cargando...' : (mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta')}
                </button>

                <div className="auth-switch-link">
                  {mode === 'login' ? '¿Todavía no tienes una cuenta?' : '¿Ya tienes una cuenta?'}
                  <a onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
                    {mode === 'login' ? 'Crear cuenta' : 'Iniciar sesión'}
                  </a>
                </div>

                <div className="auth-footer-terms">
                  <p style={{marginBottom: 16}}>Al crear una cuenta aceptas los<br/>Términos de servicio y privacidad</p>
                  
                  <span style={{opacity: 0.6}}>¿Prefieres privacidad offline?</span>
                  <div style={{display: 'flex', gap: 12, justifyContent: 'center', marginTop: 6}}>
                     <a style={{color: '#aeb4ff', cursor: 'pointer', textDecoration: 'underline'}} onClick={() => setAdvancedMode('seed-login')}>Usar Semilla P2P</a>
                     <a style={{color: '#aeb4ff', cursor: 'pointer', textDecoration: 'underline'}} onClick={() => {
                       const phrase = SeedPhrase.generate();
                       setGeneratedSeed(phrase);
                       setAdvancedMode('seed-generate');
                     }}>Generar Semilla</a>
                  </div>
                </div>
             </>
          )}

          {advancedMode === 'seed-login' && (
            <div className="fade-in">
              <button className="header-btn" style={{ marginBottom: 24, background: 'transparent', color: '#fff' }} onClick={() => setAdvancedMode('none')}>
                <ArrowLeft size={16} style={{marginRight: 6}}/> Volver al modo Nube
              </button>
              <h2>Modo Semilla Offline</h2>
              <p className="login-subtitle">Ingresa tus 16 palabras para restaurar tu identidad descentralizada P2P.</p>
              
              <label className="auth-input-label">Frase semilla</label>
              <textarea 
                className="login-input" 
                style={{ width: '100%', minHeight: 120, resize: 'none', lineHeight: 1.5 }}
                placeholder="palabra1 palabra2 palabra3..." 
                value={seedInput} onChange={e => setSeedInput(e.target.value)}
              />
              
              <button className="login-btn-primary glow" onClick={() => {
                if (SeedPhrase.isValid(seedInput)) {
                     setAdvancedMode('onboarding'); // Pide el apodo P2P
                     setUsername(''); // Reseteamos
                } else {
                     alert('La frase semilla es inválida. Asegúrate de verificar las 12-16 palabras.');
                }
              }} disabled={seedInput.split(' ').length < 12}>
                Validar Identidad P2P
              </button>
            </div>
          )}

          {advancedMode === 'seed-generate' && (
            <div className="fade-in">
              <button className="header-btn" style={{ marginBottom: 24, background: 'transparent', color: '#fff' }} onClick={() => setAdvancedMode('none')}>
                <ArrowLeft size={16} style={{marginRight: 6}}/> Volver
              </button>
              <h2>Tu Llave Privada</h2>
              <p className="login-subtitle">Guarda estas palabras en un lugar físico seguro. Si pierdes esto, pierdes el acceso a tus notas P2P para siempre.</p>
              
              <div style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: '24px 16px', marginBottom: 24 }}>
                <p style={{ fontFamily: 'monospace', fontSize: 16, lineHeight: 1.6, color: '#aeb4ff', fontWeight: 'bold', margin: 0, textAlign: 'center' }}>
                  {generatedSeed}
                </p>
              </div>

              <button className="auth-google-btn" style={{ marginBottom: 16 }} onClick={() => navigator.clipboard.writeText(generatedSeed)}>
                <Copy size={16} /> Copiar frase al portapapeles
              </button>
              <button className="login-btn-primary glow" onClick={() => {
                setAdvancedMode('onboarding');
              }}>
                Ya guardé la frase en lugar seguro
              </button>
            </div>
          )}

          {advancedMode === 'onboarding' && (
            <div className="fade-in">
              <h2>Apodo Público P2P</h2>
              <p className="login-subtitle">¿Cómo quieres que te vean en tus grupos descentralizados?</p>
              
              <label className="auth-input-label">Nombre o Apodo</label>
              <input className="login-input" style={{ width: '100%' }} placeholder="Ej: Maestro Alpha"
                value={username} onChange={(e) => setUsername(e.target.value)} />

              <label className="auth-input-label" style={{marginTop: 24}}>Color de Interfaz P2P</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {colors.map((c) => (
                  <button key={c} onClick={() => setColor(c)}
                    style={{
                      width: 28, height: 28, borderRadius: '50%', border: color === c ? '2px solid #fff' : '2px solid transparent',
                      background: c, cursor: 'pointer', transition: 'all 120ms ease',
                    }} />
                ))}
              </div>

              <button onClick={() => {
                const phraseSource = seedInput || generatedSeed;
                const creds = SeedPhrase.deriveCredentials(phraseSource);
                handleFinishOnboarding('seed', creds.userId, phraseSource, creds.syncPoolId);
              }} disabled={!username.trim()} className="login-btn-primary glow">
                <Zap size={16} style={{marginRight: 8}}/> Ingresar al Workspace
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import { Play, ArrowRight, Cloud, Smartphone, Monitor, Shield, Server, Key, Layout, Users, FileText, Calendar, Lock, CheckCircle, BookOpen, Menu, X } from 'lucide-react';

interface LandingScreenProps {
  onStart: () => void;
}

export const LandingScreen: React.FC<LandingScreenProps> = ({ onStart }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleScroll = useCallback(() => {
    const container = document.querySelector('.landing-container');
    const scrollTop = container ? container.scrollTop : window.scrollY;
    setIsScrolled(scrollTop > 80);
  }, []);

  useEffect(() => {
    const container = document.querySelector('.landing-container') as HTMLElement | null;
    if (!container) return;
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const navLinks = [
    { href: '#hero', label: 'Inicio' },
    { href: '#features', label: 'Funciones' },
    { href: '#security', label: 'Seguridad' },
    { href: '#mobile', label: 'Mobile' },
    { href: '#footer', label: 'Equipo' },
  ];

  return (
    <div className="landing-container">
      {/* NAVBAR */}
      <header role="banner" className={isScrolled ? 'landing-navbar is-solid' : 'landing-navbar'}>
        <nav aria-label="Navegación principal">
          <div className="landing-nav-left">
            <a href="#hero" className="landing-logo">
              <svg width="28" height="28" viewBox="0 0 501 498" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M0 0 C165.33 0 330.66 0 501 0 C501 164.34 501 328.68 501 498 C335.67 498 170.34 498 0 498 C0 333.66 0 169.32 0 0 Z M102 65 C101.95318129 79.31714999 101.91809609 93.63428803 101.89637566 107.95149899 C101.88594964 114.59993959 101.87181192 121.24831498 101.84912109 127.89672852 C101.82735075 134.3157915 101.81542248 140.73480499 101.81024551 147.15390205 C101.8065573 149.59983664 101.79935517 152.0457686 101.78853989 154.49168205 C101.77396946 157.92411983 101.7720244 161.35635451 101.77294922 164.78881836 C101.76575867 165.79439285 101.75856812 166.79996735 101.75115967 167.83601379 C101.79323716 182.31945789 106.50957764 193.11551209 116.546875 203.66796875 C125.007815 211.71125088 135.11114923 217.00466671 145.28808594 222.52392578 C174.32523639 238.32862614 174.32523639 238.32862614 187 247 C187.87422607 247.59458008 187.87422607 247.59458008 188.76611328 248.20117188 C195.86145299 253.05119881 202.51877393 258.09509621 208.81640625 263.96875 C211.27419264 266.25506292 213.82719153 268.39701019 216.4296875 270.515625 C219.72619997 273.63173131 221.8471479 275.69617156 222.390625 280.33203125 C222.34421875 281.48058594 222.2978125 282.62914062 222.25 283.8125 C222.21390625 284.97394531 222.1778125 286.13539063 222.140625 287.33203125 C222.09421875 288.21246094 222.0478125 289.09289062 222 290 C221.46632812 289.31035156 220.93265625 288.62070312 220.3828125 287.91015625 C199.57764745 261.66973181 166.7769935 247.37933764 136.96484375 233.66796875 C129.1343092 230.06620431 121.5267889 226.34931282 114.1875 221.8125 C113.5476416 221.42054443 112.9077832 221.02858887 112.24853516 220.62475586 C109.03633773 218.57568407 106.33297594 216.43832152 103.67578125 213.69921875 C102.79277344 212.80847656 101.90976563 211.91773438 101 211 C100.34 211 99.68 211 99 211 C98.72929688 210.42636719 98.45859375 209.85273438 98.1796875 209.26171875 C96.98075282 206.96309895 95.61528199 204.93209796 94.125 202.8125 C87.80253982 193.40591291 84.70595881 183.80204003 84.69702148 172.48852539 C84.68858215 171.67941711 84.68014282 170.87030884 84.67144775 170.03668213 C84.64587333 167.39033355 84.63358189 164.74409591 84.62109375 162.09765625 C84.60490554 160.25059644 84.58772416 158.40354508 84.56959534 156.5565033 C84.52408561 151.71548357 84.48917729 146.87445243 84.45739746 142.0333252 C84.40533657 134.26028245 84.34053509 126.48736291 84.26918221 118.71447563 C84.24630084 115.99724832 84.23006865 113.28003701 84.21446228 110.5627594 C84.20106433 108.9104087 84.1874503 107.25805973 84.17358398 105.60571289 C84.17097061 104.84576523 84.16835724 104.08581757 84.16566467 103.30284119 C84.439268 99.86151751 84.439268 99.86151751 83 97 C81.48071962 96.92820036 79.95832518 96.91607993 78.4375 96.9375 C77.19806641 96.95103516 77.19806641 96.95103516 75.93359375 96.96484375 C75.29550781 96.97644531 74.65742187 96.98804687 74 97 C73.90682169 108.08425768 73.83599426 119.16842031 73.79275131 130.25299168 C73.77198415 135.40146909 73.74386803 140.54967616 73.69824219 145.69799805 C73.65439303 150.67769418 73.63078143 155.65713228 73.62049103 160.63700676 C73.61316911 162.52538037 73.59887381 164.41374182 73.57707977 166.30200386 C73.34711854 187.07525057 77.34563092 204.32899957 92 220 C107.77435145 235.05416751 128.1036274 244.06588519 147.68041992 253.10668945 C169.92661923 263.38082774 195.98374986 275.93020414 211 296 C211.721875 296.88171875 212.44375 297.7634375 213.1875 298.671875 C215.43719545 301.79828999 216.93075049 304.2929738 218 308 C215.26535601 323.49054667 201.07520935 338.57470316 188.57421875 347.546875 C170.86647739 359.58794116 150.6054787 366.2374005 129.3125 367.75390625 C126.84361596 367.93320512 126.84361596 367.93320512 124 369 C124 367.35 124 365.7 124 364 C120.04 364.33 116.08 364.66 112 365 C112.495 372.425 112.495 372.425 113 380 C144.59201924 381.06191661 177.69870262 374.32134554 202 353 C202.75667969 352.38640625 203.51335937 351.7728125 204.29296875 351.140625 C222.26408652 336.16984875 232.36557232 313.44795644 234.79854774 290.5083847 C235.15280059 286.09740196 235.14735795 281.69349001 235.14526367 277.27050781 C235.14862228 276.23668976 235.1519809 275.2028717 235.15544128 274.13772583 C235.16488769 270.74284643 235.16689124 267.3480167 235.16796875 263.953125 C235.17118581 261.57574443 235.17455021 259.19836405 235.17805481 256.82098389 C235.18403038 251.84484397 235.18589634 246.86872138 235.18530273 241.89257812 C235.18520123 235.54359011 235.19884903 229.1947142 235.21607494 222.84575272 C235.22724124 217.93670144 235.22922052 213.02767687 235.22869301 208.1186142 C235.22986632 205.77925989 235.23425128 203.43990474 235.24202538 201.10056305 C235.32812683 172.51500948 230.54501001 153.29528372 210 132.5 C201.56902449 124.15307879 192.66761811 116.85210339 183 110 C182.37657715 109.54786133 181.7531543 109.09572266 181.11083984 108.62988281 C164.5479137 96.61990257 146.7697031 85.77954706 128.25244141 77.06445312 C125.47643536 75.75257513 122.71322591 74.4150934 119.94921875 73.078125 C115.82417895 71.08837768 111.69889069 69.09924599 107.56640625 67.125 C106.70990479 66.71507813 105.85340332 66.30515625 104.97094727 65.8828125 C103.20783243 64.93187 103.20783243 64.93187 102 65 Z M379.9140625 68.33203125 C379.18975037 68.67955948 378.46543823 69.02708771 377.71917725 69.38514709 C362.48894812 76.71190422 347.33450014 84.00627373 333 93 C332.2776416 93.45036621 331.5552832 93.90073242 330.81103516 94.36474609 C312.8173218 105.64185757 295.93397533 117.96225267 280.50146484 132.58203125 C279.1736031 133.83605093 277.83193654 135.07541768 276.48828125 136.3125 C265.70979639 146.5454769 255.92485745 160.34898859 254.80989647 175.60040283 C254.7339002 178.62509191 254.71832452 181.64427609 254.7253418 184.66992188 C254.72023087 185.81581787 254.71511993 186.96171387 254.70985413 188.14233398 C254.69599441 191.91785968 254.69691305 195.69320193 254.69921875 199.46875 C254.69532821 202.10941637 254.6909928 204.75008212 254.68623352 207.39074707 C254.67803451 212.92522795 254.67891727 218.45965777 254.68432617 223.99414062 C254.69034498 230.3515487 254.67810314 236.70873428 254.6567561 243.06610441 C254.63901264 248.55608113 254.63315916 254.04598789 254.63639385 259.53599215 C254.63818897 262.80050842 254.63439662 266.06483359 254.62167931 269.32933044 C254.523374 298.10715737 258.30096784 323.66261572 279.1796875 345.18359375 C302.70739029 368.67870969 333.16474862 379.83239829 366.33764648 380.20874023 C369.55906385 380.18109267 372.77955961 380.08401149 376 380 C376 375.05 376 370.1 376 365 C372.04 364.67 368.08 364.34 364 364 C364 365.32 364 366.64 364 368 C335.20501149 365.62128356 309.91452371 357.88408045 289 337 C287.99646484 336.01386719 287.99646484 336.01386719 286.97265625 335.0078125 C280.48412736 328.15145317 272.25073933 316.39385299 271.875 306.8125 C276.73050259 290.35774122 297.93622153 276.80842704 312 269 C329.67230387 259.39447336 347.73545727 250.46330944 365.8125 241.6484375 C378.84114271 235.27970843 389.6728651 228.1600783 400 218 C400.6084375 217.41605469 401.216875 216.83210937 401.84375 216.23046875 C415.79108762 201.57834546 416.45842036 181.75949951 416.29296875 162.8203125 C416.28735989 160.91218401 416.28309591 159.00405114 416.28010559 157.09591675 C416.26875825 152.12127339 416.23938048 147.14690101 416.20599365 142.17236328 C416.17507235 137.0771857 416.16155354 131.9819635 416.14648438 126.88671875 C416.11449915 116.92436138 416.06342818 106.9622034 416 97 C413.03 97 410.06 97 407 97 C406.99413376 97.95862946 406.98826752 98.91725891 406.98222351 99.90493774 C406.92469444 108.99531263 406.85177904 118.0854552 406.76428509 127.17559242 C406.71979852 131.84751239 406.68049629 136.51934949 406.65356445 141.19140625 C406.62731263 145.71089242 406.58676069 150.23005589 406.53681374 154.74934006 C406.52029143 156.46261924 406.50868701 158.17595404 406.50238609 159.8893013 C406.42158437 179.86467437 403.37040265 197.53814381 388.84375 212.48046875 C374.39942668 225.27798048 355.14293911 232.98434226 337.91015625 241.18359375 C298.96092012 259.58946413 298.96092012 259.58946413 268 289 C268 289.66 268 290.32 268 291 C267.34 291 266.68 291 266 291 C267.37550676 276.01313528 267.37550676 276.01313528 273 271 C273.59039062 270.46503906 274.18078125 269.93007813 274.7890625 269.37890625 C276.12284694 268.18593969 277.47260717 267.01064858 278.8359375 265.8515625 C281.06138329 263.94748072 283.21451653 261.97726225 285.375 260 C289.99556135 255.90503731 294.84342027 252.38840826 300 249 C301.57007813 247.96166016 301.57007813 247.96166016 303.171875 246.90234375 C313.81371257 240.00734133 324.94164672 233.97386493 336.0657196 227.90461731 C341.57717933 224.89579364 347.07073009 221.85829492 352.53125 218.7578125 C353.63275391 218.13277832 354.73425781 217.50774414 355.86914062 216.86376953 C371.61046044 207.49311798 383.38223053 196.08733575 388 178 C388.48638877 174.07108963 388.5102204 170.21955278 388.45410156 166.26464844 C388.45468567 165.16074265 388.45526978 164.05683685 388.45587158 162.91947937 C388.45311252 159.31577731 388.42212332 155.71293032 388.390625 152.109375 C388.38315488 149.59304252 388.3774656 147.07670417 388.37347412 144.56036377 C388.35982692 138.64261009 388.32838871 132.72516587 388.28807616 126.80753827 C388.23871903 119.39908973 388.2174403 111.99060248 388.1953125 104.58203125 C388.15254917 91.38786878 388.08515229 78.19395356 388 65 C385.3651685 65 382.30308347 67.18234798 379.9140625 68.33203125 Z M130.3671875 256.94921875 C128.72894389 258.19547338 127.13404607 259.50002784 125.578125 260.84765625 C114.86218237 269.79384472 99.4201539 272.65798461 86 274 C86 302.38 86 330.76 86 360 C100.66026078 360.24311516 100.66026078 360.24311516 115 358.8125 C115.81702393 358.6794043 116.63404785 358.54630859 117.47583008 358.40917969 C144.20177286 353.82275242 166.73743754 344.24734848 187 326 C188.01707031 325.10861328 188.01707031 325.10861328 189.0546875 324.19921875 C192.8622813 320.66359593 195.87814472 316.60384339 198.875 312.375 C199.26913086 311.82408691 199.66326172 311.27317383 200.06933594 310.70556641 C202.23615631 307.54490538 203.94237018 304.88681133 204 301 C202.68906692 298.67486201 202.68906692 298.67486201 200.6875 296.6875 C200.05199219 295.99011719 199.41648437 295.29273438 198.76171875 294.57421875 C197.14520665 292.77789619 197.14520665 292.77789619 195 293 C194.74347656 293.59425781 194.48695313 294.18851562 194.22265625 294.80078125 C189.48234018 305.06348574 182.63386137 312.83573206 174 320 C174 320.66 174 321.32 174 322 C173.46761719 322.24363281 172.93523437 322.48726563 172.38671875 322.73828125 C169.97934182 324.01092077 167.77948037 325.48282004 165.53540039 327.02075195 C159.78592166 330.91429862 153.98111323 334.15358261 147.5625 336.8125 C146.93255127 337.07764404 146.30260254 337.34278809 145.65356445 337.6159668 C138.55518611 340.43253125 131.49811121 342.00050368 124 344 C124 329.81 124 315.62 124 301 C127.63 300.01 131.26 299.02 135 298 C137.82944807 296.87806684 140.51982047 295.75106751 143.25 294.4375 C143.96309326 294.09887939 144.67618652 293.76025879 145.41088867 293.41137695 C153.08022272 289.6525307 160.06552292 284.96075044 167 280 C168.19689453 279.17435547 168.19689453 279.17435547 169.41796875 278.33203125 C169.94003906 277.89246094 170.46210938 277.45289063 171 277 C171 276.34 171 275.68 171 275 C169.61518672 274.12808053 168.21654754 273.27809616 166.8125 272.4375 C166.03519531 271.96183594 165.25789063 271.48617188 164.45703125 270.99609375 C161.41701197 269.7636535 160.08092284 269.94535763 157 271 C154.85890178 272.34278804 154.85890178 272.34278804 152.75 274.0625 C142.38901418 281.57808076 130.1818865 286.32176222 118 290 C115.99902921 290.6637472 113.99891352 291.33008269 112 292 C111.97506053 297.90413108 111.95702787 303.80823068 111.94506836 309.71240234 C111.9400763 311.71598852 111.93328032 313.71957112 111.92456055 315.72314453 C111.88009471 326.2118496 111.87649882 336.56117017 113 347 C105.08 347.495 105.08 347.495 97 348 C97.33 326.88 97.66 305.76 98 284 C103.61 282.68 109.22 281.36 115 280 C132.52769662 273.7431206 132.52769662 273.7431206 146 262 C138.63813777 257.00195281 138.63813777 257.00195281 130.3671875 256.94921875 Z M348.75 259.5 C347.85796875 259.9640625 346.9659375 260.428125 346.046875 260.90625 C345.37140625 261.2671875 344.6959375 261.628125 344 262 C356.31401248 275.01315971 373.01390429 280.08013176 390 284 C390.33 305.12 390.66 326.24 391 348 C384.07 347.505 384.07 347.505 377 347 C377 328.85 377 310.7 377 292 C374.03 291.01 371.06 290.02 368 289 C355.97298998 284.76741763 345.62188423 280.16677573 335.359375 272.453125 C332.75871804 270.85139588 331.04904461 270.17599789 328 270 C325.49334382 270.93836754 325.49334382 270.93836754 323.1875 272.4375 C322.39730469 272.91058594 321.60710937 273.38367188 320.79296875 273.87109375 C320.20128906 274.24363281 319.60960937 274.61617188 319 275 C319 275.66 319 276.32 319 277 C320.90018055 278.61189867 322.78434497 280.06251898 324.8125 281.5 C325.42834961 281.93707275 326.04419922 282.37414551 326.67871094 282.82446289 C331.84555531 286.38892342 337.21158577 289.48925288 342.75 292.4375 C343.51675049 292.85 344.28350098 293.2625 345.07348633 293.6875 C351.22824817 296.87432959 357.96698512 300 365 300 C365 314.85 365 329.7 365 345 C330.34950071 334.10984308 330.34950071 334.10984308 316.56640625 322.21484375 C315.06698157 320.79571712 315.06698157 320.79571712 313 321 C313 320.34 313 319.68 313 319 C310.66666667 316.33333333 310.66666667 316.33333333 308 314 C307.34 314 306.68 314 306 314 C306 313.34 306 312.68 306 312 C305.34 312 304.68 312 304 312 C303.61134766 311.18208984 303.61134766 311.18208984 303.21484375 310.34765625 C301.79968083 307.61288803 300.20877314 305.03967367 298.5625 302.4375 C297.96566406 301.48746094 297.36882812 300.53742188 296.75390625 299.55859375 C295.29292196 297.42731377 293.90254133 295.72799625 292 294 C290.79505926 295.04267939 289.61144579 296.11004291 288.4375 297.1875 C287.77621094 297.77917969 287.11492187 298.37085938 286.43359375 298.98046875 C284.74817024 300.91707807 284.74817024 300.91707807 285.10546875 303.421875 C292.08501269 323.53759116 312.95276259 337.74628717 331.11328125 346.7421875 C350.32737466 355.84619777 372.33519019 360.28962348 393.5625 360.0625 C394.78936523 360.05573242 394.78936523 360.05573242 396.04101562 360.04882812 C398.02737647 360.03721198 400.0136988 360.01928448 402 360 C403.20108768 356.39673696 403.13975646 353.11321749 403.12939453 349.36328125 C403.13114685 348.5873764 403.13289917 347.81147156 403.13470459 347.01205444 C403.1391083 344.44551359 403.13619031 341.87904156 403.1328125 339.3125 C403.13348596 337.53035468 403.13445635 335.74820946 403.13571167 333.96606445 C403.13718664 330.2302971 403.13504053 326.49455364 403.13037109 322.75878906 C403.12467393 317.96686399 403.12795401 313.17499492 403.13394356 308.3830719 C403.13755458 304.70283587 403.13640808 301.02261314 403.13381577 297.34237671 C403.133148 295.57530714 403.13396969 293.80823637 403.13629532 292.04116821 C403.13883068 289.57298576 403.13496871 287.10489441 403.12939453 284.63671875 C403.13243088 283.53787857 403.13243088 283.53787857 403.13552856 282.4168396 C403.1226081 279.33350852 402.98314551 276.94943653 402 274 C401.00742187 273.84144531 400.01484375 273.68289063 398.9921875 273.51953125 C385.62953065 271.27640735 373.79625073 267.83548614 362.61669922 259.94677734 C357.29634375 256.23931643 354.33769119 256.5591099 348.75 259.5 Z" fill="currentColor"/>
                <path d="M0 0 C4.11576387 1.33458108 7.82497266 2.82410773 11.640625 4.87109375 C12.70249023 5.43989258 13.76435547 6.00869141 14.85839844 6.59472656 C15.97762695 7.2028418 17.09685547 7.81095703 18.25 8.4375 C19.40790039 9.06495117 20.56580078 9.69240234 21.75878906 10.33886719 C35.85222957 18.01336088 49.48952327 26.19264823 62.36621094 35.78369141 C63.97891658 36.984304 65.60269041 38.1700028 67.2265625 39.35546875 C80.60589573 49.25072766 92.45736983 60.32284535 102 74 C102.53238281 74.73863281 103.06476563 75.47726563 103.61328125 76.23828125 C111.02804051 87.1526319 110.40359394 98.91283608 110.29296875 111.5703125 C110.2873649 113.46173769 110.28309853 115.35316727 110.28010559 117.24459839 C110.26871893 122.19299605 110.23930572 127.14112436 110.20599365 132.0894165 C110.17515873 137.15071979 110.16157171 142.21206711 110.14648438 147.2734375 C110.11442946 157.18240921 110.06330886 167.0911821 110 177 C106.24755302 175.74918434 104.7440193 173.82901105 102 171 C81.96606229 152.99366626 57.64000979 140.27031161 33.9050293 127.88183594 C25.21226586 123.29431345 16.62748072 118.38490708 10 111 C9.154375 110.071875 8.30875 109.14375 7.4375 108.1875 C1.08943689 100.41763095 -0.15516163 92.74148746 -0.11352539 82.98706055 C-0.11367142 82.08900192 -0.11381744 81.1909433 -0.1139679 80.26567078 C-0.11327287 77.30599528 -0.10549965 74.34638321 -0.09765625 71.38671875 C-0.09579061 69.33120254 -0.0943674 67.27568588 -0.09336853 65.22016907 C-0.08955482 59.81642423 -0.0797343 54.41270637 -0.06866455 49.00897217 C-0.0584258 43.49231328 -0.05386563 37.97565003 -0.04882812 32.45898438 C-0.03811102 21.63931108 -0.02104834 10.81965779 0 0 Z" fill="currentColor" transform="translate(113,82)"/>
                <path d="M0 0 C0.09289098 12.08330439 0.16386192 24.1665231 0.20724869 36.25011253 C0.2280776 41.86169469 0.25630944 47.47303161 0.30175781 53.08447266 C0.34538299 58.50504576 0.3691724 63.92538374 0.37950897 69.34611893 C0.38687046 71.4088778 0.40124547 73.47162455 0.42292023 75.53428268 C0.4521758 78.43507939 0.45594677 81.33491815 0.45410156 84.23583984 C0.46848267 85.07885651 0.48286377 85.92187317 0.49768066 86.79043579 C0.42258698 97.7796946 -4.58547783 106.17808651 -12 114 C-21.06369232 122.15368305 -32.61558274 127.44010561 -43.34521484 133.03164673 C-65.36400619 144.53787831 -86.90192987 156.9972967 -104.984375 174.2578125 C-106.92853272 175.9382279 -108.69621621 176.9045322 -111 178 C-111.06970476 167.09012488 -111.12291496 156.18030331 -111.15543652 145.27025032 C-111.17105021 140.203524 -111.19220958 135.13695075 -111.22631836 130.0703125 C-111.25906555 125.17494083 -111.27688528 120.27971582 -111.28463173 115.38424301 C-111.29014777 113.52245655 -111.30091888 111.66067754 -111.31719017 109.79895401 C-111.47360546 91.14990369 -108.14522089 79.18941516 -95.09375 65.24609375 C-93.44748966 63.48004954 -91.92590246 61.70820179 -90.4375 59.8125 C-87.24847113 56.13285131 -83.73837224 53.11157929 -80 50 C-79.1656543 49.29713867 -79.1656543 49.29713867 -78.31445312 48.58007812 C-68.94276601 40.70314069 -59.34791184 33.53904291 -49 27 C-47.98035156 26.34902344 -46.96070313 25.69804688 -45.91015625 25.02734375 C-5.97946612 0 -5.97946612 0 0 0 Z" fill="currentColor" transform="translate(377,82)"/>
              </svg>
              <span className="landing-logo-text">Briefly</span>
            </a>
            <div className="landing-nav-links" role="list">
              {navLinks.map(({ href, label }) => (
                <a key={href} href={href} role="listitem">{label}</a>
              ))}
            </div>
          </div>
          <div className="landing-nav-right">
            <button className="landing-btn-outline" onClick={onStart}>
              Iniciar sesión
            </button>
            <button
              className="landing-hamburger"
              aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu"
              onClick={() => setMobileMenuOpen(prev => !prev)}
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </nav>
        {/* Mobile menu */}
        <div id="mobile-menu" className={`landing-mobile-menu${mobileMenuOpen ? ' is-open' : ''}`} aria-hidden={!mobileMenuOpen}>
          {navLinks.map(({ href, label }) => (
            <a key={href} href={href} onClick={() => setMobileMenuOpen(false)}>{label}</a>
          ))}
          <button className="landing-btn-outline" onClick={onStart}>
            Iniciar sesión
          </button>
        </div>
      </header>

      {/* HERO SECTION */}
      <section id="hero" className="landing-hero">
        <div className="landing-hero-content">
          <h1 className="landing-hero-title">Una ruta clara<br />para estudiar mejor.</h1>
          <p className="landing-hero-subtitle">
            Briefly conecta tus grupos, hojas, tareas y calendario en una experiencia web y móvil.
          </p>
          <div className="landing-hero-actions">
            <button className="landing-btn-primary" onClick={onStart}>
              Probar ahora <span className="landing-btn-arrow"><ArrowRight size={18} /></span>
            </button>
          </div>
          <div className="landing-hero-badges">
            <span className="landing-badge"><Cloud size={14} /> Cloud-first</span>
            <span className="landing-badge"><Smartphone size={14} /> APK Android</span>
            <span className="landing-badge"><Monitor size={14} /> Web + Mobile</span>
          </div>
        </div>
        
        {/* HERO VISUAL - real device mockups */}
        <div className="landing-hero-visuals">
          <img src="/landing/device-mockups.webp" alt="" className="hero-devices-img" />
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
              <a href="https://github.com/JhovaYu/Briefly_Cloud_First_Always_Online/releases/latest/download/briefly-demo-android.apk" target="_blank" rel="noopener noreferrer" className="landing-btn-secondary">
                <Smartphone size={18} /> Descargar APK
              </a>
              <a href="https://github.com/JhovaYu/Briefly_Cloud_First_Always_Online.git" target="_blank" rel="noreferrer" className="landing-btn-outline cta-github-btn">
                <img src="/landing/github-mark.svg" alt="" width="18" onError={(e) => e.currentTarget.style.display='none'} /> Ver repositorio
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
              <a href="#security">Seguridad</a>
              <a href="#mobile">Mobile</a>
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

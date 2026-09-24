import React, { useState } from 'react';
import styles from './LandingPage.module.css';

interface LandingPageProps {
  onNavigateToMap: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigateToMap }) => {
  const [lang, setLang] = useState<'ko' | 'en'>('ko');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem('ks_isLoggedIn') === 'true';
  });
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('••••••••');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const triggerToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2800);
  };

  const handleLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const effectiveUser = username.trim() || 'admin';
    localStorage.setItem('ks_isLoggedIn', 'true');
    localStorage.setItem('ks_user', effectiveUser);
    setIsLoggedIn(true);
    triggerToast(
      lang === 'ko'
        ? `환영합니다, ${effectiveUser} 관제사님!`
        : `Welcome, Operator ${effectiveUser}!`,
      'success'
    );
  };

  const handleLogout = () => {
    localStorage.removeItem('ks_isLoggedIn');
    setIsLoggedIn(false);
    setIsMenuVisible(false);
    triggerToast(
      lang === 'ko' ? '정상적으로 로그아웃되었습니다.' : 'Logged out successfully.',
      'success'
    );
  };

  const menuItems = [
    {
      key: 'map',
      group: lang === 'ko' ? '대한감시 실시간 레이더' : 'KOREAN SURVEILLANCE',
      title: lang === 'ko' ? '항공감시 관제 맵' : 'Surveillance Radar Map',
      subtitle: '3D Route & Radar',
      icon: '/assets/landing/login_route_control.svg',
      action: onNavigateToMap,
    },
    {
      key: 'ifs',
      group: lang === 'ko' ? '정보융합지원 단말' : 'SURVEILLANCE IFS',
      title: lang === 'ko' ? 'IFS 관제 단말' : 'IFS Fusion Terminal',
      subtitle: 'Information Fusion',
      icon: '/assets/landing/login_planner.svg',
      action: () => { window.location.href = '/ifs'; },
    },
    {
      key: 'efs',
      group: lang === 'ko' ? '전자비행스트립' : 'SURVEILLANCE EFS',
      title: lang === 'ko' ? 'EFS 전자비행스트립' : 'Electronic Flight Strip',
      subtitle: '4-Bay Flight Strips',
      icon: '/assets/landing/login_plan_control.svg',
      action: () => { window.location.href = '/efs'; },
    },
    {
      key: 'dashboard',
      group: lang === 'ko' ? '연계 게이트웨이' : 'SURVEILLANCE GATEWAY',
      title: lang === 'ko' ? '연계 API 대시보드' : 'Gateway Dashboard',
      subtitle: 'Live Health & Ping',
      icon: '/assets/landing/login_sentinel.svg',
      action: () => { window.location.href = '/api-dashboard'; },
    },
    {
      key: 'docs',
      group: lang === 'ko' ? '오픈 API 인터페이스' : 'SURVEILLANCE OPENAPI',
      title: lang === 'ko' ? 'API 명세 & Swagger' : 'API Docs & Swagger',
      subtitle: 'OpenAPI 3.0 Specs',
      icon: '/assets/landing/login_maintenance.svg',
      action: () => { window.location.href = '/docs'; },
    },
  ];

  return (
    <div className={styles.loginPage}>
      {/* Background Images */}
      <img
        src="/assets/landing/login_background.png"
        className={styles.backgroundImage}
        alt="Korean Surveillance Background"
      />
      {isLoggedIn && (
        <img
          src="/assets/landing/login_background_human.png"
          className={styles.backgroundImage_human}
          alt="Korean Surveillance Control Room"
        />
      )}

      {/* Dark Translucent Overlay */}
      <div className={styles.rectangle} />

      {/* Top Bar: Language Selector & User Profile */}
      <div className={styles.topButtons}>
        {/* Language Selector */}
        <div className={styles.languageSelectorWrapper}>
          <div className={`${styles.movingIndicator} ${lang === 'ko' ? styles.ko : ''}`} />
          <button
            type="button"
            onClick={() => setLang('ko')}
            className={`${styles.langButton} ${lang === 'ko' ? styles.isActive : ''}`}
          >
            KR
          </button>
          <button
            type="button"
            onClick={() => setLang('en')}
            className={`${styles.langButton} ${lang === 'en' ? styles.isActive : ''}`}
          >
            EN
          </button>
        </div>

        {/* User Avatar when Logged In */}
        {isLoggedIn && (
          <button
            type="button"
            className={styles.toggleButton}
            onClick={() => setIsMenuVisible(!isMenuVisible)}
            title="User Profile"
          >
            A
          </button>
        )}
      </div>

      {/* User Dropdown Menu */}
      {isLoggedIn && isMenuVisible && (
        <div className={styles.toggleMenu}>
          <div className={styles.tooltipUserCard}>
            <div className={styles.profileRing}>A</div>
            <div className={styles.headerInfo}>
              <span className={styles.userNameText}>
                {lang === 'ko' ? '관제 관리자' : 'Chief Operator'}
              </span>
              <span className={styles.userIdText}>@admin</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className={styles.logoutBtnDiv}
          >
            {lang === 'ko' ? '로그아웃' : 'LOGOUT'}
          </button>
        </div>
      )}

      {/* Left Section: Brand Logo & Information */}
      <div className={`${styles.leftBrandWrap} ${isLoggedIn ? styles.loggedIn : ''}`}>
        <div className={styles.logoTitleBox}>
          <div className={styles.logoIconBadge}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="2" />
              <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
            </svg>
          </div>
          <div className={styles.brandTextGroup}>
            <span className={styles.brandKorean}>대한감시</span>
            <span className={styles.brandEnglish}>KOREAN SURVEILLANCE</span>
          </div>
        </div>

        <div className={styles.catchPhrase}>
          {lang === 'ko'
            ? 'REPUBLIC OF KOREA INTEGRATED AIR SURVEILLANCE GATEWAY'
            : 'REPUBLIC OF KOREA INTEGRATED AIR SURVEILLANCE GATEWAY'}
        </div>

        <h1 className={styles.mainTitleText}>
          {lang === 'ko'
            ? '대한민국 종합 항공감시 플랫폼'
            : 'Republic of Korea Integrated Air Surveillance System'}
        </h1>

        <p className={styles.descriptionWrapper}>
          {lang === 'ko'
            ? `대한민국 전역 15개 공항 및 비행정보구역(FIR)의 ASTERIX/ADS-B 실시간 3D 항적 감시, 항공기상(AMOS/METAR), UBIKAIS 실시간 운항스케줄, 정보융합지원(IFS), 전자비행스트립(EFS)을 총망라한 종합 항공감시 관제 시스템입니다.`
            : `Comprehensive low-altitude surveillance platform monitoring 15 nationwide airports and FIR with real-time ASTERIX/ADS-B 3D radar tracking, aviation weather (AMOS/METAR), UBIKAIS schedule integration, IFS fusion terminal, and electronic flight strip (EFS).`}
        </p>
      </div>

      {/* Right Section: Glassmorphic Login Container (Shown only when NOT logged in) */}
      {!isLoggedIn ? (
        <aside className={styles.loginContainer}>
          <form className={styles.loginInner} onSubmit={handleLogin}>
            <div className={styles.loginTitle}>
              {lang === 'ko' ? '로그인' : 'LOGIN'}
            </div>

            <label className={styles.loginLabel}>
              {lang === 'ko' ? '아이디' : 'Username'}
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={lang === 'ko' ? '아이디를 입력하세요' : 'Enter username'}
              className={styles.loginInput}
            />

            <label className={`${styles.loginLabel} ${styles.passwordLabel}`}>
              {lang === 'ko' ? '비밀번호' : 'Password'}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={styles.loginInput}
            />

            <button type="submit" className={styles.loginButton}>
              {lang === 'ko' ? '로그인' : 'SIGN IN'}
            </button>

            <div className={styles.quickLoginHint}>
              {lang === 'ko'
                ? '아이디 입력 후 로그인 버튼을 누르면 관제 메뉴가 활성화됩니다.'
                : 'Click Sign In to access surveillance control consoles.'}
            </div>
          </form>

          {/* Bottom Collaboration / Surveillance Badge */}
          <div className={styles.bottomLeftLogoContainer}>
            <span className={styles.bottomBrandText}>
              KOREAN SURVEILLANCE GATEWAY
            </span>
          </div>
        </aside>
      ) : (
        /* Bottom Menu Cards (Shown when Logged In) */
        <nav className={styles.menuContainer}>
          {menuItems.map((item) => (
            <div key={item.key} className={styles.menuItemOuter}>
              <div className={styles.menuWrap} onClick={item.action}>
                <div className={styles.menuInner}>
                  <div className={styles.menuIcon}>
                    <img src={item.icon} alt={item.title} />
                  </div>
                  <div className={styles.menuTitle}>
                    <span className={styles.menuSubtitle}>{item.group}</span>
                    <span className={styles.menuMainTitle}>{item.title}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </nav>
      )}

      {/* Floating Toast Notification */}
      {showToast && (
        <div
          className={`${styles.toast} ${
            showToast ? styles.showing : styles.hiding
          } ${toastType === 'error' ? styles.error : ''}`}
        >
          <span
            className={`${styles.statusIcon} ${
              toastType === 'success' ? styles.success : styles.error
            }`}
          >
            {toastType === 'success' ? '✓' : '✕'}
          </span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

export default LandingPage;

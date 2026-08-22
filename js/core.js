const sb = window.supabaseClient;
window.ClinicPages = window.ClinicPages || {};

const Clinic = window.Clinic = {
  sb,
  user: null,
  profile: null,
  roles: [],
  doctors: [],
  lang: localStorage.getItem('clinic_language') || 'ar',
  currentPage: 'dashboard',

  labels: {
    en: {
      clinic: 'Operation Clinic', logout: 'Logout', dashboard: 'Dashboard', patients: 'Patients', appointments: 'Appointments',
      schedules: "Doctors' Schedules", finance: 'Finance', logistics: 'Logistics', attendance: 'Attendance', reports: 'Reports',
      users: 'Users', records: 'Admin Records', audit: 'Audit Log', settings: 'Settings', todayClinic: "Today's Clinic", queue: 'My Queue',
      referrals: 'Referrals', mySchedule: 'My Schedule', profile: 'My Profile', technical: 'Technical Administration',
      reception: 'Reception Desk', notifications: 'Notifications', clinicManagement: 'Clinic Management', loading: 'Loading...', noData: 'No data found'
    },
    ar: {
      clinic: 'إدارة العيادة', logout: 'تسجيل الخروج', dashboard: 'الرئيسية', patients: 'المرضى', appointments: 'الحجوزات',
      schedules: 'جداول الأطباء', finance: 'المالية', logistics: 'احتياجات العيادة', attendance: 'الحضور والانصراف', reports: 'التقارير',
      users: 'المستخدمون', records: 'السجلات الإدارية', audit: 'سجل النشاط', settings: 'الإعدادات', todayClinic: 'عيادة اليوم', queue: 'قائمة الانتظار',
      referrals: 'التحويلات', mySchedule: 'جدولي', profile: 'ملفي الشخصي', technical: 'الإدارة التقنية',
      reception: 'الاستقبال', notifications: 'الإشعارات', clinicManagement: 'إدارة العيادة', loading: 'جاري التحميل...', noData: 'لا توجد بيانات'
    }
  },

  t(key) { return this.labels[this.lang]?.[key] || key; },
  hasRole(role) { return this.roles.includes(role); },
  isManagement() { return ['owner','manager','deputy_manager'].some(r => this.hasRole(r)); },
  isReception() { return this.isManagement() || this.hasRole('secretary'); },
  isDoctor() { return this.hasRole('doctor'); },

  escape(value='') {
    return String(value ?? '')
      .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
      .replaceAll('"','&quot;').replaceAll("'",'&#039;');
  },

  cairoDate(date = new Date()) {
    return date.toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
  },

  formatDate(value, options={}) {
    if (!value) return '—';

    const d = new Date(value);

    if (this.lang === 'ar') {
      const monthNames = [
        'يناير',
        'فبراير',
        'مارس',
        'أبريل',
        'مايو',
        'يونيو',
        'يوليو',
        'أغسطس',
        'سبتمبر',
        'أكتوبر',
        'نوفمبر',
        'ديسمبر'
      ];

      const parts =
        new Intl.DateTimeFormat(
          'en-CA',
          {
            timeZone:'Africa/Cairo',
            year:'numeric',
            month:'2-digit',
            day:'2-digit'
          }
        )
        .formatToParts(d);

      const valueOf = type =>
        parts.find(
          x=>x.type===type
        )?.value || '';

      const day =
        Number(
          valueOf('day')
        );

      const month =
        Number(
          valueOf('month')
        );

      const year =
        valueOf('year');

      const dateText =
        `${day} ${monthNames[month-1] || ''} ${year}`;

      const wantsTime =
        Object.prototype.hasOwnProperty.call(
          options,
          'hour'
        )
        ||
        Object.prototype.hasOwnProperty.call(
          options,
          'minute'
        )
        ||
        Object.prototype.hasOwnProperty.call(
          options,
          'second'
        );

      if (!wantsTime) {
        return dateText;
      }

      const timeText =
        new Intl.DateTimeFormat(
          'ar-EG',
          {
            timeZone:'Africa/Cairo',
            hour:
              options.hour || '2-digit',
            minute:
              options.minute || '2-digit',
            hour12:true
          }
        )
        .format(d);

      return `${dateText}، ${timeText}`;
    }

    return new Intl.DateTimeFormat(
      'en-GB',
      {
        timeZone:'Africa/Cairo',
        day:'2-digit',
        month:'2-digit',
        year:'numeric',
        ...options
      }
    ).format(d);
  },

  formatFullDate(value, includeWeekday=true) {
    if (!value) return '—';

    const d = new Date(value);

    if (this.lang === 'ar') {
      const weekday =
        new Intl.DateTimeFormat(
          'ar-EG',
          {
            timeZone:'Africa/Cairo',
            weekday:'long'
          }
        )
        .format(d);

      const dateOnly =
        this.formatDate(d);

      return includeWeekday
        ? `${weekday} ${dateOnly}`
        : dateOnly;
    }

    const weekday =
      new Intl.DateTimeFormat(
        'en-GB',
        {
          timeZone:'Africa/Cairo',
          weekday:'long'
        }
      )
      .format(d);

    return includeWeekday
      ? `${weekday}, ${this.formatDate(d)}`
      : this.formatDate(d);
  },

  formatDateOnly(value) {
    return this.formatDate(value);
  },

  formatTime(value) {
    if (!value) return '—';
    const d = new Date(value);
    return new Intl.DateTimeFormat(this.lang === 'ar' ? 'ar-EG' : 'en-GB', {
      timeZone: 'Africa/Cairo', hour: '2-digit', minute: '2-digit'
    }).format(d);
  },

  formatMoney(value) {
    const n = Number(value || 0);
    return `${new Intl.NumberFormat(this.lang === 'ar' ? 'ar-EG' : 'en-GB', { maximumFractionDigits: 2 }).format(n)} EGP`;
  },

  ageFromDob(dob) {
    if (!dob) return '—';
    const b = new Date(`${dob}T00:00:00`), now = new Date();
    let age = now.getFullYear() - b.getFullYear();
    const m = now.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
    return age;
  },

  ageFromBirthYear(birthYear, fallbackDob=null) {
    const year = Number(birthYear);

    if (Number.isInteger(year) && year >= 1900 && year <= 2100) {
      const currentYear = Number(
        new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Africa/Cairo',
          year: 'numeric'
        }).format(new Date())
      );

      return Math.max(0, currentYear - year);
    }

    return fallbackDob ? this.ageFromDob(fallbackDob) : '—';
  },

  birthYearFromPatient(patient={}) {
    const year = Number(patient.birth_year);

    if (Number.isInteger(year) && year >= 1900 && year <= 2100) {
      return year;
    }

    if (patient.date_of_birth) {
      const match = String(patient.date_of_birth).match(/^(\d{4})/);
      if (match) return Number(match[1]);
    }

    return null;
  },

  statusPill(status) {
    const safe = this.escape(status || 'unknown');
    return `<span class="status-pill status-${safe.replaceAll('_','-')}">${safe.replaceAll('_',' ')}</span>`;
  },

  async safe(queryPromise, context='Operation failed') {
    try {
      const result = await queryPromise;
      if (result?.error) throw result.error;
      return result?.data ?? result;
    } catch (err) {
      console.error(context, err);
      this.toast(`${context}: ${err.message || err}`, 'error');
      throw err;
    }
  },

  toast(message, type='success') {
    const root = document.getElementById('toastRoot');
    const item = document.createElement('div');
    item.className = `toast ${type}`;
    item.textContent = message;
    root.appendChild(item);
    setTimeout(() => item.classList.add('show'), 20);
    setTimeout(() => { item.classList.remove('show'); setTimeout(() => item.remove(), 250); }, 3300);
  },

  showModal({title='', body='', wide=false, onOpen=null}) {
    const root = document.getElementById('modalRoot');
    root.classList.remove('hidden');
    root.innerHTML = `
      <div class="modal-backdrop" data-close-modal></div>
      <section class="modal-card ${wide ? 'modal-wide' : ''}">
        <header class="modal-header"><h3>${this.escape(title)}</h3><button class="icon-button" data-close-modal>✕</button></header>
        <div class="modal-body">${body}</div>
      </section>`;
    root.querySelectorAll('[data-close-modal]').forEach(el => el.addEventListener('click', () => this.closeModal()));
    onOpen?.(root);
  },

  closeModal() {
    const root = document.getElementById('modalRoot');
    root.classList.add('hidden');
    root.innerHTML = '';
  },

  setTitle(title) { document.getElementById('pageTitle').textContent = title; },

  setLoading(message) {
    document.getElementById('mainContent').innerHTML = `<section class="content-card centered"><div class="loader"></div><p class="muted">${this.escape(message || this.t('loading'))}</p></section>`;
  },

  localizedPersonName(person={}) {
    const username =
      String(
        person.username || ''
      ).toLowerCase();

    const email =
      String(
        person.email || ''
      ).toLowerCase();

    const raw =
      String(
        person.raw_display_name
        ||
        person.display_name
        ||
        person.username
        ||
        person.email
        ||
        ''
      );

    const rawLower =
      raw.toLowerCase();

    const isAhmed =
      username === 'ahmed.alaa'
      ||
      email === 'ahalamo@yahoo.com'
      ||
      email === 'ahalam0@yahoo.com'
      ||
      rawLower === 'dr ahmed alaa'
      ||
      rawLower.includes('ahmed alaa');

    const isMohamed =
      username === 'mohamed.alaa'
      ||
      username === 'mohamed.alaa.owner'
      ||
      email === 'drmohamedalaa90@gmail.com'
      ||
      email === 'drmohamedalaa90@icloud.com'
      ||
      rawLower === 'dr mohamed alaa'
      ||
      rawLower.includes('mohamed alaa');

    if (this.lang === 'ar') {
      if (isAhmed) {
        return 'د أحمد علاء';
      }

      if (isMohamed) {
        return 'د محمد علاء';
      }
    }

    if (isAhmed) {
      return 'Dr Ahmed Alaa';
    }

    if (isMohamed) {
      return 'Dr Mohamed Alaa';
    }

    return raw || 'User';
  },

  async loadDoctors(force=false) {
    if (this.doctors.length && !force) {
      return this.doctors;
    }

    const { data, error } =
      await sb.rpc(
        'list_active_doctors'
      );

    if (!error && Array.isArray(data)) {
      this.doctors =
        data.map(doctor=>{
          const rawDisplay =
            doctor.raw_display_name
            ||
            doctor.display_name
            ||
            doctor.username;

          const record = {
            ...doctor,
            raw_display_name:
              rawDisplay
          };

          return {
            ...record,
            display_name:
              this.localizedPersonName(
                record
              )
          };
        });

      return this.doctors;
    }

    if (this.isDoctor()) {
      const fallback = {
        id:this.user.id,
        username:this.profile.username,
        email:this.profile.email,
        raw_display_name:
          this.profile.display_name,
        display_name:
          this.profile.display_name,
        photo_url:
          this.profile.photo_url
      };

      fallback.display_name =
        this.localizedPersonName(
          fallback
        );

      this.doctors = [
        fallback
      ];
    }

    console.warn(
      'list_active_doctors unavailable.',
      error
    );

    return this.doctors;
  },

  doctorName(id) {
    const doctor =
      this.doctors.find(
        d=>d.id===id
      );

    return doctor
      ? this.localizedPersonName(
          doctor
        )
      : (
          this.lang==='ar'
            ?'الطبيب'
            :'Doctor'
        );
  },

  navItem(icon, key, page) {
    return `<button class="nav-item ${this.currentPage === page ? 'active' : ''}" data-page="${page}"><span class="nav-icon">${icon}</span><span>${this.t(key)}</span></button>`;
  },

  buildNavigation() {
    let menu = '';

    // Doctors start from TODAY'S CLINIC.
    if (this.isDoctor() && !this.hasRole('owner')) {
      menu += this.navItem('☀','todayClinic','today-clinic');
      menu += this.navItem('📅','appointments','doctor-appointments');
      menu += this.navItem('⌛','queue','queue');
      menu += this.navItem('👥','patients','patients');
      menu += this.navItem('⇄','referrals','referrals');
      menu += this.navItem('🕒','mySchedule','my-schedule');
      menu += this.navItem('⌂','dashboard','dashboard');
      menu += this.navItem('👤','profile','profile');
    }

    // Secretary's operational home is BOOKINGS, not Dashboard.
    else if (this.hasRole('secretary') && !this.isManagement()) {
      menu += this.navItem('📅','appointments','appointments');
      menu += this.navItem('👥','patients','patients');
      menu += this.navItem('🛎','reception','reception');
      menu += this.navItem('💳','finance','finance');
      menu += this.navItem('📦','logistics','logistics');
      menu += this.navItem('✓','attendance','attendance');
      menu += this.navItem('⌂','dashboard','dashboard');
      menu += this.navItem('👤','profile','profile');
    }

    else {
      menu += this.navItem('⌂','dashboard','dashboard');

      if (this.isManagement()) {
        menu += this.navItem('📅','appointments','appointments');
        menu += this.navItem('👥','patients','patients');
        menu += this.navItem('🛎','reception','reception');
        menu += this.navItem('🕒','schedules','schedules');
        menu += this.navItem('💳','finance','finance');
        menu += this.navItem('📦','logistics','logistics');
        menu += this.navItem('✓','attendance','attendance');
        menu += this.navItem('📊','reports','reports');
        menu += this.navItem('👤','profile','profile');

        if (this.hasRole('owner')) {
          menu += this.navItem('🗂','records','admin-records');
          menu += this.navItem('👥','users','users');
          menu += this.navItem('◷','audit','audit');
          menu += this.navItem('⚙','settings','settings');
        }
      }
    }

    // V80: Logistics is available to every authenticated clinic member.
    // Add it natively rather than mutating the sidebar later.
    if (!menu.includes('data-page="logistics"')) {
      menu += this.navItem('📦','logistics','logistics');
    }

    if (this.hasRole('technical_admin')) {
      menu += this.navItem('⚙','technical','technical');
    }

    document.getElementById('navigation').innerHTML = menu;

    document
      .querySelectorAll('.nav-item')
      .forEach(btn =>
        btn.addEventListener(
          'click',
          () => this.route(btn.dataset.page)
        )
      );
  },

  primaryRoleLabel() {
    if (this.hasRole('owner') && this.hasRole('technical_admin')) return this.lang === 'ar' ? 'المالك / المستشار التقني' : 'Owner / Technical Advisor';
    if (this.hasRole('owner')) return this.lang === 'ar' ? 'المالك / مدير النظام' : 'Owner / Administrator';
    if (this.isDoctor() && this.hasRole('technical_admin')) return this.lang === 'ar' ? 'طبيب / مستشار تقني' : 'Doctor / Technical Advisor';
    if (this.isDoctor()) return this.lang === 'ar' ? 'طبيب' : 'Doctor';
    if (this.hasRole('secretary')) return this.lang === 'ar' ? 'سكرتارية' : 'Secretary';
    if (this.hasRole('manager')) return this.lang === 'ar' ? 'مدير العيادة' : 'Clinic Manager';
    if (this.hasRole('deputy_manager')) return this.lang === 'ar' ? 'نائب مدير العيادة' : 'Deputy Manager';
    return this.roles.join(', ');
  },

  applyLanguage() {
    document.documentElement.lang = this.lang;
    document.documentElement.dir = this.lang === 'ar' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-i18n]').forEach(el => { const k = el.dataset.i18n; if (this.labels[this.lang]?.[k]) el.textContent = this.labels[this.lang][k]; });
    document.querySelectorAll('.app-lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === this.lang));
    document.getElementById('notificationTitle').textContent = this.t('notifications');
    const now = new Date();
    const weekday = new Intl.DateTimeFormat(
      this.lang === 'ar' ? 'ar-EG' : 'en-GB',
      { timeZone:'Africa/Cairo', weekday:'long' }
    ).format(now);

    document
      .getElementById('todayDate')
      .textContent =
        this.formatFullDate(
          now,
          true
        );

    if (this.profile) {
      document
        .getElementById('profileName')
        .textContent =
          this.localizedPersonName(
            this.profile
          );

      document
        .getElementById('profileRole')
        .textContent =
          this.primaryRoleLabel();
    }

    this.buildNavigation();
  },

  routeStateKey() {
    return this.user?.id
      ? `clinic_route_state_${this.user.id}`
      : 'clinic_route_state';
  },

  saveRouteState(page, params={}) {
    if (!this.user?.id) return;
    try {
      sessionStorage.setItem(
        this.routeStateKey(),
        JSON.stringify({page,params:params||{}})
      );
    } catch (error) {
      console.warn('Could not save clinic route state', error);
    }
  },

  loadRouteState() {
    if (!this.user?.id) return null;
    try {
      const raw=sessionStorage.getItem(this.routeStateKey());
      if (!raw) return null;
      const parsed=JSON.parse(raw);
      if (!parsed || typeof parsed.page!=='string') return null;
      return {
        page:parsed.page,
        params:
          parsed.params && typeof parsed.params==='object'
            ? parsed.params
            : {}
      };
    } catch (error) {
      console.warn('Could not restore clinic route state', error);
      return null;
    }
  },

  clearSessionState() {
    if (!this.user?.id) return;
    try {
      sessionStorage.removeItem(this.routeStateKey());
      sessionStorage.removeItem(
        `clinic_attendance_reminder_${this.user.id}_${this.cairoDate()}`
      );
    } catch (error) {
      console.warn('Could not clear clinic session state', error);
    }
  },

  async maybeShowSecretaryCheckInReminder({freshLogin=false}={}) {
    if (
      !freshLogin
      || !this.hasRole('secretary')
      || this.isManagement()
      || !window.matchMedia('(min-width: 900px)').matches
    ) {
      return;
    }

    const reminderKey=
      `clinic_attendance_reminder_${this.user.id}_${this.cairoDate()}`;

    if (sessionStorage.getItem(reminderKey)) return;

    const {data,error}=await this.sb.rpc(
      'frontend_get_staff_attendance_today',
      {p_staff_id:this.user.id}
    );

    if (error) {
      console.warn('Could not check secretary attendance reminder state',error);
      return;
    }

    const record=Array.isArray(data)?(data[0]||null):data;
    if (record?.check_in_at) return;

    sessionStorage.setItem(reminderKey,'shown');

    this.showModal({
      title:this.lang==='ar'?'تذكير تسجيل الحضور':'Check-in reminder',
      body:`
        <div class="secretary-login-reminder">
          <div class="secretary-login-reminder-icon">✓</div>
          <div>
            <strong>
              ${this.lang==='ar'
                ?'لم يتم تسجيل حضورك اليوم بعد'
                :'You have not checked in today'}
            </strong>
            <p>
              ${this.lang==='ar'
                ?'أنتِ تستخدمين نسخة اللابتوب. يمكنك تسجيل الحضور الآن قبل بدء العمل.'
                :'You are on the laptop site. You can check in now before starting work.'}
            </p>
          </div>
        </div>

        <div class="form-actions">
          <button id="loginReminderCheckIn" class="primary-button compact" type="button">
            ${this.lang==='ar'?'تسجيل الحضور الآن':'Check in now'}
          </button>

          <button id="loginReminderLater" class="secondary-button" type="button">
            ${this.lang==='ar'?'لاحقاً':'Later'}
          </button>
        </div>
      `,
      onOpen:(root)=>{
        root.querySelector('#loginReminderLater')
          ?.addEventListener('click',()=>this.closeModal());

        root.querySelector('#loginReminderCheckIn')
          ?.addEventListener('click',async()=>{
            const button=root.querySelector('#loginReminderCheckIn');
            button.disabled=true;

            const {error}=await this.sb.rpc(
              'frontend_staff_check_in',
              {p_note:'Check-in from login reminder'}
            );

            button.disabled=false;

            if (error) return this.toast(error.message,'error');

            this.closeModal();
            this.toast(
              this.lang==='ar'
                ?'تم تسجيل الحضور بنجاح.'
                :'Checked in successfully.'
            );
          });
      }
    });
  },

  async route(page, params={}) {
    this.currentPage = page;
    this.saveRouteState(page, params);
    this.buildNavigation();
    this.closeMobileSidebar();
    const renderer = window.ClinicPages[page];
    if (!renderer) {
      this.setTitle(page.replaceAll('-',' '));
      document.getElementById('mainContent').innerHTML = `<section class="content-card centered"><div class="placeholder-icon">◇</div><h2>${this.escape(page.replaceAll('-',' '))}</h2><p class="muted">${this.lang === 'ar' ? 'هذه الصفحة ضمن مرحلة الواجهة التالية.' : 'This page is part of the next interface block.'}</p></section>`;
      return;
    }
    this.setLoading();
    try { await renderer(params); } catch (err) { console.error(err); }
  },

  closeMobileSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('show');
  },

  async refreshAvatar() {
    const el = document.getElementById('profileAvatar');
    if (!el) return;
    el.style.backgroundImage = '';
    el.style.backgroundSize = '';
    el.style.backgroundPosition = '';
    el.textContent = (this.profile?.display_name || this.profile?.username || 'U').trim().charAt(0).toUpperCase();
    if (!this.profile?.photo_url) return;
    const { data, error } = await this.sb.storage.from('profile-photos').createSignedUrl(this.profile.photo_url, 3600);
    if (!error && data?.signedUrl) {
      el.textContent = '';
      el.style.backgroundImage = `url("${data.signedUrl}")`;
      el.style.backgroundSize = 'cover';
      el.style.backgroundPosition = 'center';
    }
  },

  async init() {
    const { data: { user }, error } = await sb.auth.getUser();
    if (error || !user) { location.href = 'index.html'; return; }
    this.user = user;

    const { data: profile, error: profileError } = await sb.from('profiles')
      .select('id,username,email,display_name,photo_url,whatsapp,preferred_language,is_active').eq('id', user.id).single();
    if (profileError || !profile || !profile.is_active) {
      await sb.auth.signOut(); location.href = 'index.html'; return;
    }
    this.profile = profile;

    const { data: roles, error: rolesError } = await sb.from('user_roles').select('role').eq('user_id', user.id);
    if (rolesError || !roles?.length) { alert('No clinic role assigned.'); await sb.auth.signOut(); location.href='index.html'; return; }
    this.roles = roles.map(x => x.role);

    if (!localStorage.getItem('clinic_language') && profile.preferred_language) this.lang = profile.preferred_language;

    document.getElementById('profileName').textContent =
      this.localizedPersonName(
        profile
      );
    document.getElementById('profileRole').textContent = this.primaryRoleLabel();
    document.getElementById('profileAvatar').textContent = (profile.display_name || profile.username || 'U').trim().charAt(0).toUpperCase();
    await this.refreshAvatar();

    await this.loadDoctors();
    this.applyLanguage();
    document.getElementById('appLoading').classList.add('hidden');
    document.getElementById('appRoot').classList.remove('hidden');

    const savedRoute=this.loadRouteState();
    const freshLogin=!savedRoute;

    const initialRoute=savedRoute||{
      page:
        this.isDoctor() && !this.hasRole('owner')
          ? 'today-clinic'
          : (
              this.hasRole('secretary') && !this.isManagement()
                ? 'appointments'
                : 'dashboard'
            ),
      params:{}
    };

    await this.route(
      initialRoute.page,
      initialRoute.params
    );

    window.ClinicNotifications?.refresh?.();

    await this.maybeShowSecretaryCheckInReminder({
      freshLogin
    });
  }
};

// Global UI wiring
window.addEventListener('DOMContentLoaded', () => {
  document.addEventListener(
    'keydown',
    event=>{
      if(event.key!=='Escape'){
        return;
      }

      const modalRoot =
        document.getElementById(
          'modalRoot'
        );

      if(
        modalRoot
        &&
        !modalRoot.classList.contains(
          'hidden'
        )
      ){
        Clinic.closeModal();
        return;
      }

      if(
        document
          .getElementById(
            'notificationDrawer'
          )
          ?.classList.contains(
            'open'
          )
      ){
        window
          .ClinicNotifications
          ?.close?.();
        return;
      }

      if(
        document
          .getElementById(
            'sidebar'
          )
          ?.classList.contains(
            'open'
          )
      ){
        Clinic.closeMobileSidebar();
      }
    }
  );

  document.querySelectorAll('.app-lang-btn').forEach(btn => btn.addEventListener('click', async () => {
    Clinic.lang = btn.dataset.lang;
    localStorage.setItem('clinic_language', Clinic.lang);
    await Clinic.loadDoctors(true);
    Clinic.applyLanguage();
    await Clinic.route(Clinic.currentPage);
  }));

  document.getElementById('logoutButton').addEventListener('click', async () => {
    Clinic.clearSessionState();
    await sb.auth.signOut();
    location.href='index.html';
  });
  document.getElementById('menuButton').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('show');
  });
  document.getElementById('sidebarOverlay').addEventListener('click', () => Clinic.closeMobileSidebar());
  Clinic.init();
});

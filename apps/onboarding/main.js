// =============================================================
// BANTAYOG Onboarding - Interactive JS Logic
// =============================================================

// Step Data for Interactive 5-Step Workflow Simulator
const workflowSteps = [
  {
    stepNum: "Step 01 / 05",
    title: "LGU Registration: Guardians, Children & Merchants",
    desc: "LGUs use the Admin Portal to register eligible guardians, children, and sari-sari store merchants under RA 11148. The system automatically computes each child's age and assigns Tier 1 (First 1,000 Days: ₱5,000) or Tier 2 (Standard: ₱3,500). Guardian PINs are stored as salted one-way Argon2id hashes.",
    highlight: "The Admin Portal manages all beneficiary and merchant onboarding in one place.",
    visualHtml: `
      <div style="background:#FFFFFF; padding:1.25rem; border-radius:12px; border:1px solid #BDD5D6; box-shadow:0 4px 16px rgba(0,75,73,0.08); width:100%;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
          <strong style="color:#004B49; font-size:0.9rem;">LGU Registry Entry</strong>
          <span style="background:#E0F2F1; color:#004B49; font-size:0.75rem; font-weight:700; padding:0.25rem 0.6rem; border-radius:99px;">RA 11148</span>
        </div>
        <div style="text-align:left; font-size:0.85rem; color:#374151; display:flex; flex-direction:column; gap:0.35rem;">
          <div><strong>Child Age:</strong> 184 Days Post-Birth</div>
          <div><strong>Calculated Tier:</strong> <span style="color:#E07A65; font-weight:700;">Tier 1 Critical</span></div>
          <div><strong>Assigned Grant:</strong> <span style="color:#017075; font-weight:700;">₱5,000 Nutri-Credits</span></div>
          <div style="font-size:0.75rem; color:#6B7280; margin-top:0.25rem;">PIN Security: Argon2id One-Way Salted Hash</div>
        </div>
      </div>
    `
  },
  {
    stepNum: "Step 02 / 05",
    title: "QR Nutri-Pass Issuance",
    desc: "The system issues a physical QR Nutri-Pass card for the guardian. No smartphone or cellular data is required — the QR card acts as an offline digital wallet, signed cryptographically with JWS tokens to prevent forgery.",
    highlight: "📲 Zero digital barrier: the QR Nutri-Pass card works entirely offline at any registered store counter.",
    visualHtml: `
      <div style="background:linear-gradient(135deg, #004B49, #017075); color:#FFF; padding:1.25rem; border-radius:12px; box-shadow:0 8px 24px rgba(0,75,73,0.25); width:100%;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
          <span style="font-family:'Outfit'; font-weight:800; letter-spacing:0.05em;">NUTRI-PASS</span>
          <span style="background:#E07A65; font-size:0.7rem; font-weight:700; padding:0.2rem 0.5rem; border-radius:99px;">JWS SIGNED</span>
        </div>
        <div style="background:#FFF; padding:0.75rem; border-radius:8px; display:inline-block; margin:0.5rem 0;">
          <i class="ph ph-qr-code" style="font-size:3.5rem; color:#004B49;"></i>
        </div>
        <div style="font-size:0.8rem; opacity:0.9;">Scan at store counter • Works Offline</div>
      </div>
    `
  },
  {
    stepNum: "Step 03 / 05",
    title: "AI Product Scan at Sari-Sari Store",
    desc: "At the sari-sari counter, the merchant snaps a photo of the product using the Bantayog Android app. Google Gemini Vision identifies the brand and product name — differentiating between branded and non-branded items. The Approved Food List then determines whether the item qualifies for the nutrition program.",
    highlight: "Gemini Vision identifies both branded and non-branded items. The Approved Food List makes all eligibility decisions.",
    visualHtml: `
      <div style="background:#FFFFFF; padding:1.25rem; border-radius:12px; border:2px dashed #E07A65; box-shadow:0 4px 16px rgba(224,122,101,0.15); width:100%; position:relative;">
        <div style="position:absolute; top:8px; right:8px; background:#FEECE8; color:#E07A65; font-size:0.7rem; font-weight:700; padding:0.2rem 0.5rem; border-radius:99px;">
          Gemini Vision AI
        </div>
        <i class="ph ph-camera" style="font-size:2.5rem; color:#004B49; margin-bottom:0.5rem;"></i>
        <div style="font-weight:700; color:#004B49; font-size:0.95rem;">Fortified Milk 300g</div>
        <div style="font-size:0.8rem; color:#6B7280; margin-top:0.25rem;">Brand & product identified — checking Approved Food List…</div>
      </div>
    `
  },
  {
    stepNum: "Step 04 / 05",
    title: "Approved Food List & PIN Authorization",
    desc: "The system checks the identified item against the official Approved Food List. If eligible, the guardian presents their paper Nutri-Pass and enters their secure 6-digit PIN on the merchant's device to authorize the transaction.",
    highlight: "Funds can only be spent on approved food. Non-nutritious purchases are blocked at the system level.",
    visualHtml: `
      <div style="background:#F0F9F8; padding:1.25rem; border-radius:12px; border:1px solid #BDD5D6; width:100%;">
        <div style="display:flex; align-items:center; justify-content:center; gap:0.5rem; color:#004B49; font-weight:700; font-size:1rem; margin-bottom:0.5rem;">
          <i class="ph ph-check-circle" style="color:#017075; font-size:1.4rem;"></i> Eligibility Verified
        </div>
        <div style="background:#FFF; padding:0.6rem; border-radius:8px; border:1px solid #BDD5D6; font-size:0.85rem; color:#374151; margin-bottom:0.5rem;">
          <i class="ph ph-check" style="color:#017075;"></i> Approved Food List Match<br>
          <i class="ph ph-check" style="color:#017075;"></i> 6-Digit PIN Authorized
        </div>
        <span style="font-size:0.75rem; color:#017075; font-weight:600;">Zero Fund Diversion Lock</span>
      </div>
    `
  },
  {
    stepNum: "Step 05 / 05",
    title: "Polygon Blockchain Settlement & Payout",
    desc: "Upon PIN confirmation, credits are instantly deducted from the pass, credited to the store balance, and recorded as an immutable itemized receipt on the public Polygon Amoy network (PHPC ERC-20 token). Merchants can cash out instantly.",
    highlight: "⛓️ 100% transparent audit trail on Polygon Amoy with zero paperwork.",
    visualHtml: `
      <div style="background:#004B49; color:#FFF; padding:1.25rem; border-radius:12px; box-shadow:0 8px 24px rgba(0,75,73,0.2); width:100%;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
          <span style="font-size:0.8rem; opacity:0.85;">Polygon Amoy #80002</span>
          <span style="background:#E0F2F1; color:#004B49; font-size:0.7rem; font-weight:700; padding:0.2rem 0.5rem; border-radius:99px;">SETTLED</span>
        </div>
        <div style="font-family:monospace; font-size:0.75rem; opacity:0.9; background:rgba(255,255,255,0.1); padding:0.5rem; border-radius:6px; margin:0.5rem 0;">
          Tx: 0x9f8a...3b4e<br>
          Amount: 145 PHPC Credits
        </div>
        <div style="font-size:0.8rem; color:#FFC0B4; font-weight:600;">Instant Store Wallet Credit</div>
      </div>
    `
  }
];

document.addEventListener('DOMContentLoaded', () => {
  // 1. Mobile Menu Toggle
  const mobileToggle = document.getElementById('mobileToggle');
  const navMenu = document.getElementById('navMenu');

  if (mobileToggle && navMenu) {
    mobileToggle.addEventListener('click', () => {
      navMenu.classList.toggle('active');
      const icon = mobileToggle.querySelector('i');
      if (icon) {
        icon.className = navMenu.classList.contains('active') ? 'ph ph-x' : 'ph ph-list';
      }
    });
  }

  // 2. Interactive Simulator Calculator
  const btnTier1 = document.getElementById('simAgeTier1');
  const btnTier2 = document.getElementById('simAgeTier2');
  const simTierTag = document.getElementById('simTierNameTag');
  const simAmount = document.getElementById('simGrantAmount');
  const simDesc = document.getElementById('simTierDesc');
  const heroPassBalance = document.getElementById('heroPassBalance');
  const heroPassTierBadge = document.getElementById('heroPassTierBadge');

  function setSimulatorTier(tier) {
    if (tier === 1) {
      btnTier1 && btnTier1.classList.add('active');
      btnTier2 && btnTier2.classList.remove('active');

      if (simTierTag) simTierTag.textContent = 'TIER 1 CRITICAL';
      if (simAmount) simAmount.textContent = '₱5,000';
      if (simDesc) simDesc.textContent = 'Highest priority window. Funds are locked strictly to essential nutrition: fortified milk, eggs, pulses, and fresh vegetables.';
      if (heroPassBalance) heroPassBalance.textContent = '₱5,000';
      if (heroPassTierBadge) heroPassTierBadge.textContent = 'TIER 1 CRITICAL';
    } else {
      btnTier2 && btnTier2.classList.add('active');
      btnTier1 && btnTier1.classList.remove('active');

      if (simTierTag) simTierTag.textContent = 'TIER 2 STANDARD';
      if (simAmount) simAmount.textContent = '₱3,500';
      if (simDesc) simDesc.textContent = 'Standard nutrition subsidy window. Funds continue supporting essential child growth and balanced dietary purchases.';
      if (heroPassBalance) heroPassBalance.textContent = '₱3,500';
      if (heroPassTierBadge) heroPassTierBadge.textContent = 'TIER 2 STANDARD';
    }
  }

  if (btnTier1) btnTier1.addEventListener('click', () => setSimulatorTier(1));
  if (btnTier2) btnTier2.addEventListener('click', () => setSimulatorTier(2));

  // 3. Workflow Tab Switcher
  const tabButtons = document.querySelectorAll('.workflow-tab-btn');
  const stepNumEl = document.getElementById('workflowStepNum');
  const stepTitleEl = document.getElementById('workflowStepTitle');
  const stepDescEl = document.getElementById('workflowStepDesc');
  const stepHighlightEl = document.getElementById('workflowHighlight');
  const visualBoxContainer = document.getElementById('workflowVisualBoxContainer');

  // Track current step index for mobile nav
  let currentStepIndex = 0;
  const totalSteps = workflowSteps.length;

  function loadStep(index) {
    // Clamp index to valid range
    index = Math.max(0, Math.min(index, totalSteps - 1));
    currentStepIndex = index;

    const data = workflowSteps[index];
    if (!data) return;

    tabButtons.forEach((btn, idx) => {
      btn.classList.toggle('active', idx === index);
    });

    if (stepNumEl) stepNumEl.textContent = data.stepNum;
    if (stepTitleEl) stepTitleEl.textContent = data.title;
    if (stepDescEl) stepDescEl.textContent = data.desc;
    if (stepHighlightEl) stepHighlightEl.innerHTML = data.highlight;
    if (visualBoxContainer && data.visualHtml) {
      visualBoxContainer.innerHTML = data.visualHtml;
    }

    // Update mobile counter and button states
    const mobileCounter = document.getElementById('workflowMobileCounter');
    const prevBtn = document.getElementById('workflowPrevBtn');
    const nextBtn = document.getElementById('workflowNextBtn');

    if (mobileCounter) mobileCounter.textContent = `${index + 1} of ${totalSteps}`;
    if (prevBtn) prevBtn.disabled = index === 0;
    if (nextBtn) nextBtn.disabled = index === totalSteps - 1;
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.currentTarget.getAttribute('data-step') || '0', 10);
      loadStep(index);
    });
  });

  loadStep(0);

  // Mobile Prev/Next button handlers
  const prevBtn = document.getElementById('workflowPrevBtn');
  const nextBtn = document.getElementById('workflowNextBtn');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => loadStep(currentStepIndex - 1));
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', () => loadStep(currentStepIndex + 1));
  }

  // Touch swipe support (keep alongside buttons)
  const workflowDisplay = document.querySelector('.workflow-display');
  if (workflowDisplay) {
    let touchStartX = 0;
    let touchStartY = 0;

    workflowDisplay.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].clientX;
      touchStartY = e.changedTouches[0].clientY;
    }, { passive: true });

    workflowDisplay.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      // Only treat as horizontal swipe if horizontal movement dominates
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx < 0) {
          loadStep(currentStepIndex + 1); // swipe left → next
        } else {
          loadStep(currentStepIndex - 1); // swipe right → prev
        }
      }
    }, { passive: true });
  }

  // 4. Stats Counter Animation on Scroll
  const statNumbers = document.querySelectorAll('.stat-number');
  let animated = false;

  function checkScrollStats() {
    if (animated) return;
    const statsSection = document.querySelector('.stats-section');
    if (!statsSection) return;

    const rect = statsSection.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom >= 0) {
      animated = true;
      statNumbers.forEach(stat => {
        const target = stat.getAttribute('data-target');
        if (target) stat.textContent = target;
      });
    }
  }

  window.addEventListener('scroll', checkScrollStats);
  checkScrollStats();

  // 5. Scroll-Spy: highlight the active nav link as sections scroll into view
  const navLinks = document.querySelectorAll('.nav-link');
  const spySections = Array.from(
    document.querySelectorAll('section[id], header[id]')
  ).filter(el => {
    // Only spy on sections that have a matching nav link
    const href = '#' + el.id;
    return Array.from(navLinks).some(link => link.getAttribute('href') === href);
  });

  function setActiveNav(id) {
    navLinks.forEach(link => {
      const matches = link.getAttribute('href') === '#' + id;
      link.classList.toggle('active', matches);
    });
  }

  if ('IntersectionObserver' in window && spySections.length > 0) {
    const spyObserver = new IntersectionObserver(
      (entries) => {
        // Find the entry that is intersecting with the highest ratio
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length > 0) {
          setActiveNav(visible[0].target.id);
        }
      },
      {
        root: null,
        // Trigger when a section occupies at least the middle 40% of the viewport
        rootMargin: '-30% 0px -50% 0px',
        threshold: 0
      }
    );
    spySections.forEach(section => spyObserver.observe(section));
  }
});

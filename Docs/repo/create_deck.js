const pptxgen = require("pptxgenjs");

let pres = new pptxgen();
pres.layout = 'LAYOUT_16x9';
pres.author = 'FrankMax Digital';
pres.title = 'The Next 30 Days';

const COLORS = {
  cherry: "990011",
  offWhite: "FCF6F5",
  navy: "2F3C7E",
  white: "FFFFFF",
  gray: "666666",
  darkGray: "333333"
};

const FONTS = {
  header: "Georgia",
  body: "Calibri"
};

// Helper: Shadow factory to avoid mutation issues
const makeShadow = () => ({ type: "outer", color: "000000", blur: 6, offset: 2, opacity: 0.15 });

// ============================================
// SLIDE 1: TITLE
// ============================================
let slide1 = pres.addSlide();
slide1.background = { color: COLORS.navy };

slide1.addText("The Next 30 Days", {
  x: 0.5, y: 1.8, w: 9, h: 1,
  fontSize: 44, bold: true, fontFace: FONTS.header,
  color: COLORS.white, align: "center", valign: "middle"
});

slide1.addText("From $0 to First Revenue — One Action at a Time", {
  x: 0.5, y: 2.9, w: 9, h: 0.8,
  fontSize: 20, fontFace: FONTS.body,
  color: COLORS.offWhite, align: "center", valign: "middle"
});

slide1.addText("FrankMax Digital | February 2026", {
  x: 0.5, y: 5.0, w: 9, h: 0.4,
  fontSize: 14, fontFace: FONTS.body,
  color: COLORS.white, align: "center", valign: "middle"
});

// Visual element: centered rectangle accent
slide1.addShape(pres.shapes.RECTANGLE, {
  x: 3.5, y: 1.5, w: 3, h: 0.08,
  fill: { color: COLORS.cherry }, line: { type: "none" }
});

// ============================================
// SLIDE 2: THE TRUTH
// ============================================
let slide2 = pres.addSlide();
slide2.background = { color: COLORS.cherry };

slide2.addText("You have $1,000 and an idea.", {
  x: 0.5, y: 0.8, w: 9, h: 0.7,
  fontSize: 36, bold: true, fontFace: FONTS.header,
  color: COLORS.white, align: "center", valign: "middle"
});

slide2.addText([
  { text: "You do not have a product.", options: { breakLine: true } },
  { text: "You do not have a customer.", options: { breakLine: true } },
  { text: "You do not have a website.", options: {} }
], {
  x: 1.5, y: 1.8, w: 7, h: 1.5,
  fontSize: 20, fontFace: FONTS.body,
  color: COLORS.offWhite, align: "center", valign: "middle"
});

slide2.addText("You have 30 days to change that.", {
  x: 0.5, y: 3.6, w: 9, h: 0.8,
  fontSize: 28, bold: true, fontFace: FONTS.header,
  color: COLORS.white, align: "center", valign: "middle"
});

// Visual: three circles as accents
[1.5, 4.5].forEach(x => {
  slide2.addShape(pres.shapes.OVAL, {
    x, y: 4.8, w: 0.5, h: 0.5,
    fill: { color: COLORS.offWhite, transparency: 30 }, line: { type: "none" }
  });
});

// ============================================
// SLIDE 3: THE ONE SERVICE
// ============================================
let slide3 = pres.addSlide();
slide3.background = { color: COLORS.offWhite };

slide3.addText("One Service. One Buyer. One Price.", {
  x: 0.5, y: 0.4, w: 9, h: 0.6,
  fontSize: 36, bold: true, fontFace: FONTS.header,
  color: COLORS.navy, align: "center", margin: 0
});

// Main card
slide3.addShape(pres.shapes.RECTANGLE, {
  x: 1.5, y: 1.3, w: 7, h: 3.5,
  fill: { color: COLORS.white },
  shadow: makeShadow()
});

slide3.addText("Revenue Chokepoint Diagnostic", {
  x: 1.7, y: 1.5, w: 6.6, h: 0.5,
  fontSize: 28, bold: true, fontFace: FONTS.header,
  color: COLORS.cherry, align: "center"
});

slide3.addText("Find the #1 operational bottleneck costing your company revenue.", {
  x: 1.9, y: 2.1, w: 6.2, h: 0.5,
  fontSize: 16, fontFace: FONTS.body,
  color: COLORS.darkGray, align: "center"
});

slide3.addText("Deliver in 5-10 business days.", {
  x: 1.9, y: 2.7, w: 6.2, h: 0.4,
  fontSize: 16, fontFace: FONTS.body,
  color: COLORS.darkGray, align: "center"
});

slide3.addText("Price: $5,000 - $15,000", {
  x: 1.9, y: 3.2, w: 6.2, h: 0.5,
  fontSize: 24, bold: true, fontFace: FONTS.header,
  color: COLORS.navy, align: "center"
});

slide3.addText("Cost to deliver: $0 (your expertise + AI)", {
  x: 1.9, y: 3.8, w: 6.2, h: 0.4,
  fontSize: 14, fontFace: FONTS.body,
  color: COLORS.gray, align: "center"
});

slide3.addText("Margin: 100%", {
  x: 1.9, y: 4.3, w: 6.2, h: 0.4,
  fontSize: 18, bold: true, fontFace: FONTS.header,
  color: COLORS.cherry, align: "center"
});

// ============================================
// SLIDE 4: THE BUYER
// ============================================
let slide4 = pres.addSlide();
slide4.background = { color: COLORS.white };

slide4.addText("Who Writes the Check", {
  x: 0.5, y: 0.4, w: 9, h: 0.6,
  fontSize: 36, bold: true, fontFace: FONTS.header,
  color: COLORS.navy, align: "center", margin: 0
});

// Three buyer cards
const buyerData = [
  {
    title: "COO / Founder",
    details: "$5M-$100M companies, feels pain daily, has budget authority, 7-14 day sales cycle",
    x: 0.6
  },
  {
    title: "CFO",
    details: "Revenue leakage, billing drift, 14-21 day cycle, $10-25K deals",
    x: 3.6
  },
  {
    title: "CTO / CISO",
    details: "AI liability exposure, governance gaps, 14-30 day cycle, $8-20K deals",
    x: 6.6
  }
];

buyerData.forEach(buyer => {
  slide4.addShape(pres.shapes.RECTANGLE, {
    x: buyer.x, y: 1.2, w: 2.8, h: 3.2,
    fill: { color: COLORS.offWhite },
    shadow: makeShadow()
  });

  slide4.addText(buyer.title, {
    x: buyer.x + 0.15, y: 1.4, w: 2.5, h: 0.5,
    fontSize: 16, bold: true, fontFace: FONTS.header,
    color: COLORS.cherry, align: "center"
  });

  slide4.addText(buyer.details, {
    x: buyer.x + 0.15, y: 2.05, w: 2.5, h: 2.2,
    fontSize: 12, fontFace: FONTS.body,
    color: COLORS.darkGray, align: "center", valign: "top"
  });
});

slide4.addText("Start with COOs. They feel pain fastest and decide fastest.", {
  x: 0.5, y: 4.6, w: 9, h: 0.6,
  fontSize: 14, bold: true, fontFace: FONTS.header,
  color: COLORS.cherry, align: "center"
});

// ============================================
// SLIDE 5: DAYS 1-7: EXIST
// ============================================
let slide5 = pres.addSlide();
slide5.background = { color: COLORS.offWhite };

slide5.addText("Week 1: Exist", {
  x: 0.5, y: 0.4, w: 9, h: 0.6,
  fontSize: 36, bold: true, fontFace: FONTS.header,
  color: COLORS.navy, align: "center", margin: 0
});

// Seven day boxes
const days1 = [
  { day: "D1", action: "Register domain ($12)" },
  { day: "D2", action: "Build one-page site (Carrd, $0)" },
  { day: "D3", action: "LinkedIn post #1" },
  { day: "D4", action: "Identify 50 target companies" },
  { day: "D5", action: "Send 20 connection requests" },
  { day: "D6", action: "Send 20 more" },
  { day: "D7", action: "Follow up, engage on posts" }
];

days1.forEach((item, idx) => {
  const x = 0.6 + (idx * 1.3);
  slide5.addShape(pres.shapes.RECTANGLE, {
    x, y: 1.3, w: 1.15, h: 1.5,
    fill: { color: COLORS.white },
    shadow: makeShadow()
  });

  slide5.addText(item.day, {
    x: x + 0.08, y: 1.45, w: 1, h: 0.35,
    fontSize: 14, bold: true, fontFace: FONTS.header,
    color: COLORS.cherry, align: "center"
  });

  slide5.addText(item.action, {
    x: x + 0.08, y: 1.85, w: 1, h: 0.85,
    fontSize: 11, fontFace: FONTS.body,
    color: COLORS.darkGray, align: "center", valign: "top"
  });
});

slide5.addText("Cost: $12 | Revenue: $0 | Conversations: 0", {
  x: 0.5, y: 3.1, w: 9, h: 0.4,
  fontSize: 14, bold: true, fontFace: FONTS.header,
  color: COLORS.navy, align: "center"
});

slide5.addText("Goal: Be findable. Be reachable. Be credible.", {
  x: 0.5, y: 3.6, w: 9, h: 0.5,
  fontSize: 16, bold: true, fontFace: FONTS.header,
  color: COLORS.cherry, align: "center"
});

// ============================================
// SLIDE 6: DAYS 8-14: CONVERSATIONS
// ============================================
let slide6 = pres.addSlide();
slide6.background = { color: COLORS.white };

slide6.addText("Week 2: Conversations", {
  x: 0.5, y: 0.4, w: 9, h: 0.6,
  fontSize: 36, bold: true, fontFace: FONTS.header,
  color: COLORS.navy, align: "center", margin: 0
});

const days2 = [
  { day: "D8", action: "LinkedIn post #2 (chokepoint example)" },
  { day: "D9", action: "Book first 3 discovery calls" },
  { day: "D10-11", action: "Conduct 3 calls, document pain" },
  { day: "D12", action: "Write 1-page diagnostic proposal" },
  { day: "D13", action: "Send 3 proposals" },
  { day: "D14", action: "Follow up, book 3 more calls" }
];

days2.forEach((item, idx) => {
  const x = 0.6 + (idx * 1.5);
  const w = 1.35;

  slide6.addShape(pres.shapes.RECTANGLE, {
    x, y: 1.3, w, h: 1.5,
    fill: { color: COLORS.offWhite },
    shadow: makeShadow()
  });

  slide6.addText(item.day, {
    x: x + 0.1, y: 1.45, w: w - 0.2, h: 0.3,
    fontSize: 13, bold: true, fontFace: FONTS.header,
    color: COLORS.cherry, align: "center"
  });

  slide6.addText(item.action, {
    x: x + 0.1, y: 1.8, w: w - 0.2, h: 0.9,
    fontSize: 10, fontFace: FONTS.body,
    color: COLORS.darkGray, align: "center", valign: "top"
  });
});

slide6.addText("Cost: $0 | Revenue: $0 | Conversations: 6", {
  x: 0.5, y: 3.1, w: 9, h: 0.4,
  fontSize: 14, bold: true, fontFace: FONTS.header,
  color: COLORS.navy, align: "center"
});

slide6.addText("Goal: Hear real pain from real buyers in their own words.", {
  x: 0.5, y: 3.6, w: 9, h: 0.5,
  fontSize: 16, bold: true, fontFace: FONTS.header,
  color: COLORS.cherry, align: "center"
});

// ============================================
// SLIDE 7: DAYS 15-21: FIRST MONEY
// ============================================
let slide7 = pres.addSlide();
slide7.background = { color: COLORS.offWhite };

slide7.addText("Week 3: First Money", {
  x: 0.5, y: 0.4, w: 9, h: 0.6,
  fontSize: 36, bold: true, fontFace: FONTS.header,
  color: COLORS.navy, align: "center", margin: 0
});

const days3 = [
  { day: "D15-16", action: "Conduct calls #4-6, LinkedIn post #3" },
  { day: "D17-18", action: "Send 3 more proposals, follow up on all 6" },
  { day: "D19", action: "CLOSE FIRST DEAL ($5,000-$15,000)", highlight: true },
  { day: "D20-21", action: "Begin delivery, document everything" }
];

days3.forEach((item, idx) => {
  const x = 1.2 + (idx * 1.8);
  const w = 1.6;

  if (item.highlight) {
    slide7.addShape(pres.shapes.RECTANGLE, {
      x: x - 0.1, y: 1.2, w: w + 0.2, h: 1.7,
      fill: { color: COLORS.cherry },
      shadow: makeShadow()
    });
  }

  slide7.addShape(pres.shapes.RECTANGLE, {
    x, y: 1.3, w, h: 1.5,
    fill: { color: item.highlight ? COLORS.cherry : COLORS.white },
    shadow: item.highlight ? { type: "none" } : makeShadow()
  });

  slide7.addText(item.day, {
    x: x + 0.12, y: 1.45, w: w - 0.24, h: 0.3,
    fontSize: 13, bold: true, fontFace: FONTS.header,
    color: item.highlight ? COLORS.white : COLORS.cherry, align: "center"
  });

  slide7.addText(item.action, {
    x: x + 0.12, y: 1.8, w: w - 0.24, h: 0.9,
    fontSize: 11, fontFace: FONTS.body,
    color: item.highlight ? COLORS.white : COLORS.darkGray, align: "center", valign: "top"
  });
});

slide7.addText("Cost: $0 | Revenue: $5,000-$15,000 | Conversations: 10", {
  x: 0.5, y: 3.1, w: 9, h: 0.4,
  fontSize: 14, bold: true, fontFace: FONTS.header,
  color: COLORS.navy, align: "center"
});

slide7.addText("Goal: Someone pays you money for solving their problem.", {
  x: 0.5, y: 3.6, w: 9, h: 0.5,
  fontSize: 16, bold: true, fontFace: FONTS.header,
  color: COLORS.cherry, align: "center"
});

// ============================================
// SLIDE 8: DAYS 22-30: COMPOUND
// ============================================
let slide8 = pres.addSlide();
slide8.background = { color: COLORS.white };

slide8.addText("Week 4: Compound", {
  x: 0.5, y: 0.4, w: 9, h: 0.6,
  fontSize: 36, bold: true, fontFace: FONTS.header,
  color: COLORS.navy, align: "center", margin: 0
});

const days4 = [
  { day: "D22", action: "Present findings to first client" },
  { day: "D23", action: "Close second deal" },
  { day: "D24-25", action: "Deliver + publish case study (anonymized)" },
  { day: "D26-27", action: "10 new prospects from credibility" },
  { day: "D28", action: "Propose retainer to first client ($2-5K/mo)" },
  { day: "D29-30", action: "Revenue review" }
];

days4.forEach((item, idx) => {
  const x = 0.6 + (idx * 1.5);
  const w = 1.35;

  slide8.addShape(pres.shapes.RECTANGLE, {
    x, y: 1.3, w, h: 1.5,
    fill: { color: COLORS.offWhite },
    shadow: makeShadow()
  });

  slide8.addText(item.day, {
    x: x + 0.1, y: 1.45, w: w - 0.2, h: 0.3,
    fontSize: 13, bold: true, fontFace: FONTS.header,
    color: COLORS.cherry, align: "center"
  });

  slide8.addText(item.action, {
    x: x + 0.1, y: 1.8, w: w - 0.2, h: 0.9,
    fontSize: 10, fontFace: FONTS.body,
    color: COLORS.darkGray, align: "center", valign: "top"
  });
});

slide8.addText("Cost: $0 | Revenue: $10,000-$30,000 | Conversations: 15+", {
  x: 0.5, y: 3.1, w: 9, h: 0.4,
  fontSize: 14, bold: true, fontFace: FONTS.header,
  color: COLORS.navy, align: "center"
});

slide8.addText("Goal: Prove the machine works. Then run it again.", {
  x: 0.5, y: 3.6, w: 9, h: 0.5,
  fontSize: 16, bold: true, fontFace: FONTS.header,
  color: COLORS.cherry, align: "center"
});

// ============================================
// SLIDE 9: THE MATH
// ============================================
let slide9 = pres.addSlide();
slide9.background = { color: COLORS.offWhite };

slide9.addText("30-Day Financial Reality", {
  x: 0.5, y: 0.4, w: 9, h: 0.6,
  fontSize: 36, bold: true, fontFace: FONTS.header,
  color: COLORS.navy, align: "center", margin: 0
});

// Left column: Investment
slide9.addText("Investment", {
  x: 0.6, y: 1.2, w: 4.2, h: 0.5,
  fontSize: 18, bold: true, fontFace: FONTS.header,
  color: COLORS.cherry, align: "left"
});

slide9.addText([
  { text: "Total capital deployed: <$50", options: { breakLine: true } },
  { text: "Tools: $0-$20/mo", options: { breakLine: true } },
  { text: "Time: 30 days full-time", options: {} }
], {
  x: 0.8, y: 1.8, w: 4, h: 1.5,
  fontSize: 14, fontFace: FONTS.body,
  color: COLORS.darkGray, align: "left", valign: "top"
});

// Right column: Return
slide9.addText("Return", {
  x: 5.2, y: 1.2, w: 4.2, h: 0.5,
  fontSize: 18, bold: true, fontFace: FONTS.header,
  color: COLORS.cherry, align: "left"
});

slide9.addText([
  { text: "Deals closed: 2-3", options: { breakLine: true } },
  { text: "Revenue: $10,000-$30,000", options: { breakLine: true } },
  { text: "Pipeline: 5-10 proposals", options: { breakLine: true } },
  { text: "Conversations: 15+", options: { breakLine: true } },
  { text: "Case studies: 1-2", options: {} }
], {
  x: 5.4, y: 1.8, w: 4, h: 2,
  fontSize: 14, fontFace: FONTS.body,
  color: COLORS.darkGray, align: "left", valign: "top"
});

slide9.addShape(pres.shapes.RECTANGLE, {
  x: 4.8, y: 1.2, w: 0.08, h: 3.2,
  fill: { color: COLORS.navy }, line: { type: "none" }
});

slide9.addText("ROI: 200x-600x on capital. The only investment is your time.", {
  x: 0.5, y: 4.6, w: 9, h: 0.6,
  fontSize: 14, bold: true, fontFace: FONTS.header,
  color: COLORS.cherry, align: "center"
});

// ============================================
// SLIDE 10: THE UPSELL LADDER
// ============================================
let slide10 = pres.addSlide();
slide10.background = { color: COLORS.white };

slide10.addText("How $5K Becomes $500K", {
  x: 0.5, y: 0.4, w: 9, h: 0.6,
  fontSize: 36, bold: true, fontFace: FONTS.header,
  color: COLORS.navy, align: "center", margin: 0
});

const upsellSteps = [
  { step: "Step 1", title: "Diagnostic Sprint", price: "$5-15K (one-time)" },
  { step: "Step 2", title: "Fix Implementation", price: "$15-30K (project)" },
  { step: "Step 3", title: "Monthly Monitoring Retainer", price: "$2-5K/mo ($24-60K/yr)" },
  { step: "Step 4", title: "Governance Assessment", price: "$8-20K" },
  { step: "Step 5", title: "Frankmax PIAR", price: "$25-75K (institutional)" },
  { step: "Step 6", title: "Enterprise License", price: "$100-500K/yr" }
];

upsellSteps.forEach((item, idx) => {
  const yStart = 1.3 + (idx * 0.55);
  const stepWidth = 0.8 + (idx * 0.12);

  slide10.addShape(pres.shapes.RECTANGLE, {
    x: 1.0 + (idx * 0.15), y: yStart, w: stepWidth, h: 0.5,
    fill: { color: COLORS.navy },
    shadow: makeShadow()
  });

  slide10.addText(item.title, {
    x: 1.8 + (idx * 0.15), y: yStart + 0.05, w: 5, h: 0.4,
    fontSize: 13, bold: true, fontFace: FONTS.header,
    color: COLORS.cherry, align: "left"
  });

  slide10.addText(item.price, {
    x: 1.8 + (idx * 0.15), y: yStart + 0.25, w: 5, h: 0.2,
    fontSize: 11, fontFace: FONTS.body,
    color: COLORS.gray, align: "left"
  });
});

slide10.addText("One client can become $200K+ over 18 months", {
  x: 0.5, y: 5.0, w: 9, h: 0.4,
  fontSize: 15, bold: true, fontFace: FONTS.header,
  color: COLORS.cherry, align: "center"
});

// ============================================
// SLIDE 11: WHAT NOT TO DO
// ============================================
let slide11 = pres.addSlide();
slide11.background = { color: COLORS.navy };

slide11.addText("The 10 Traps", {
  x: 0.5, y: 0.4, w: 9, h: 0.6,
  fontSize: 36, bold: true, fontFace: FONTS.header,
  color: COLORS.white, align: "center", margin: 0
});

const traps = [
  "Do NOT build a product (sell the service first)",
  "Do NOT write more strategy documents",
  "Do NOT design a logo or brand identity",
  "Do NOT build the 74-system architecture",
  "Do NOT incorporate in multiple jurisdictions",
  "Do NOT attend conferences",
  "Do NOT hire anyone",
  "Do NOT raise capital",
  "Do NOT build an app",
  "Do NOT think about the ORF protocol until $50K revenue"
];

const leftTraps = traps.slice(0, 5);
const rightTraps = traps.slice(5, 10);

leftTraps.forEach((trap, idx) => {
  slide11.addText([
    { text: (idx + 1).toString(), options: { bold: true, color: COLORS.cherry } },
    { text: ". " + trap.substring(4), options: {} }
  ], {
    x: 0.7, y: 1.2 + (idx * 0.7), w: 4.3, h: 0.65,
    fontSize: 13, fontFace: FONTS.body,
    color: COLORS.offWhite, align: "left", valign: "top"
  });
});

rightTraps.forEach((trap, idx) => {
  slide11.addText([
    { text: (idx + 6).toString(), options: { bold: true, color: COLORS.cherry } },
    { text: ". " + trap.substring(4), options: {} }
  ], {
    x: 5.3, y: 1.2 + (idx * 0.7), w: 4.3, h: 0.65,
    fontSize: 13, fontFace: FONTS.body,
    color: COLORS.offWhite, align: "left", valign: "top"
  });
});

// ============================================
// SLIDE 12: THE CONVERSATION SCRIPT
// ============================================
let slide12 = pres.addSlide();
slide12.background = { color: COLORS.offWhite };

slide12.addText("The Only Script You Need", {
  x: 0.5, y: 0.4, w: 9, h: 0.6,
  fontSize: 36, bold: true, fontFace: FONTS.header,
  color: COLORS.navy, align: "center", margin: 0
});

const scriptSteps = [
  { num: "1", label: "CONNECT", text: "I help [industry] companies find their biggest revenue bottleneck." },
  { num: "2", label: "ASK", text: "What's the single biggest operational issue costing you money right now?" },
  { num: "3", label: "QUANTIFY", text: "If we fixed that, what would it be worth in monthly revenue?" },
  { num: "4", label: "OFFER", text: "I can identify your top 3 chokepoints with dollar values in 5-10 days. $[X]. If I don't find 3x that amount, I refund you." }
];

scriptSteps.forEach((step, idx) => {
  const yPos = 1.2 + (idx * 0.9);

  slide12.addShape(pres.shapes.OVAL, {
    x: 0.8, y: yPos + 0.05, w: 0.4, h: 0.4,
    fill: { color: COLORS.cherry }, line: { type: "none" }
  });

  slide12.addText(step.num, {
    x: 0.8, y: yPos + 0.05, w: 0.4, h: 0.4,
    fontSize: 18, bold: true, fontFace: FONTS.header,
    color: COLORS.white, align: "center", valign: "middle"
  });

  slide12.addText(step.label, {
    x: 1.4, y: yPos + 0.08, w: 1.2, h: 0.3,
    fontSize: 13, bold: true, fontFace: FONTS.header,
    color: COLORS.cherry, align: "left"
  });

  slide12.addText(step.text, {
    x: 1.4, y: yPos + 0.4, w: 7.6, h: 0.5,
    fontSize: 12, fontFace: FONTS.body,
    color: COLORS.darkGray, align: "left", valign: "top"
  });
});

// ============================================
// SLIDE 13: 90-DAY HORIZON
// ============================================
let slide13 = pres.addSlide();
slide13.background = { color: COLORS.white };

slide13.addText("If Day 30 Works, Then...", {
  x: 0.5, y: 0.4, w: 9, h: 0.6,
  fontSize: 36, bold: true, fontFace: FONTS.header,
  color: COLORS.navy, align: "center", margin: 0
});

const horizonData = [
  { month: "Month 2", items: ["5 clients", "$25-50K", "hire first operator", "systemize delivery"] },
  { month: "Month 3", items: ["10 clients", "$50-100K", "launch Operator Track", "case study library"] },
  { month: "Month 4-6", items: ["20 clients", "$100-200K", "vertical specialization", "first retainer portfolio"] }
];

horizonData.forEach((data, idx) => {
  const xPos = 0.8 + (idx * 2.9);

  slide13.addShape(pres.shapes.RECTANGLE, {
    x: xPos, y: 1.2, w: 2.6, h: 3.2,
    fill: { color: COLORS.offWhite },
    shadow: makeShadow()
  });

  slide13.addText(data.month, {
    x: xPos + 0.15, y: 1.35, w: 2.3, h: 0.4,
    fontSize: 15, bold: true, fontFace: FONTS.header,
    color: COLORS.cherry, align: "center"
  });

  data.items.forEach((item, itemIdx) => {
    slide13.addText(item, {
      x: xPos + 0.2, y: 1.9 + (itemIdx * 0.6), w: 2.2, h: 0.5,
      fontSize: 12, fontFace: FONTS.body,
      color: COLORS.darkGray, align: "center"
    });
  });
});

slide13.addText("Each month proves the next. Nothing is assumed.", {
  x: 0.5, y: 4.7, w: 9, h: 0.5,
  fontSize: 14, bold: true, fontFace: FONTS.header,
  color: COLORS.cherry, align: "center"
});

// ============================================
// SLIDE 14: THE TRILLION PATH
// ============================================
let slide14 = pres.addSlide();
slide14.background = { color: COLORS.navy };

slide14.addText("The Honest Compounding Path", {
  x: 0.5, y: 0.4, w: 9, h: 0.6,
  fontSize: 36, bold: true, fontFace: FONTS.header,
  color: COLORS.white, align: "center", margin: 0
});

const milestones = [
  { year: "2026", value: "$250K-$1.2M", desc: "prove the model, build credibility" },
  { year: "2027", value: "$3-10M", desc: "verticalize, operator army, first institutional clients" },
  { year: "2028", value: "$20-50M", desc: "ORF protocol deployment, cross-border, insurance layer" },
  { year: "2029", value: "$100-500M", desc: "institutional infrastructure, government pilots" },
  { year: "2030", value: "$1-5B", desc: "obligation infrastructure at scale, GDP-adjacent positioning" }
];

milestones.forEach((item, idx) => {
  const yPos = 1.3 + (idx * 0.75);

  slide14.addShape(pres.shapes.RECTANGLE, {
    x: 0.7, y: yPos, w: 1.0, h: 0.6,
    fill: { color: COLORS.cherry }, line: { type: "none" }
  });

  slide14.addText(item.year, {
    x: 0.7, y: yPos + 0.12, w: 1.0, h: 0.35,
    fontSize: 13, bold: true, fontFace: FONTS.header,
    color: COLORS.white, align: "center", valign: "middle"
  });

  slide14.addText(item.value, {
    x: 1.85, y: yPos + 0.08, w: 2.2, h: 0.35,
    fontSize: 13, bold: true, fontFace: FONTS.header,
    color: COLORS.cherry, align: "left", valign: "middle"
  });

  slide14.addText(item.desc, {
    x: 4.2, y: yPos + 0.08, w: 5.3, h: 0.44,
    fontSize: 12, fontFace: FONTS.body,
    color: COLORS.offWhite, align: "left", valign: "middle"
  });
});

slide14.addText("Trillions require decades. Billions require years. Millions require months. The first $50K requires 30 days.", {
  x: 0.5, y: 5.0, w: 9, h: 0.5,
  fontSize: 14, italic: true, fontFace: FONTS.body,
  color: COLORS.offWhite, align: "center"
});

// ============================================
// SLIDE 15: THE NEXT SINGLE ACTION
// ============================================
let slide15 = pres.addSlide();
slide15.background = { color: COLORS.cherry };

slide15.addText("Open LinkedIn.", {
  x: 0.5, y: 1.3, w: 9, h: 0.8,
  fontSize: 48, bold: true, fontFace: FONTS.header,
  color: COLORS.white, align: "center", valign: "middle"
});

slide15.addText([
  { text: "Find one COO at a $10M company.", options: { breakLine: true } },
  { text: "Send one message.", options: { breakLine: true } },
  { text: "That is the next action.", options: {} }
], {
  x: 0.5, y: 2.2, w: 9, h: 2,
  fontSize: 28, fontFace: FONTS.body,
  color: COLORS.offWhite, align: "center", valign: "top"
});

slide15.addText("Everything else is procrastination.", {
  x: 0.5, y: 4.6, w: 9, h: 0.6,
  fontSize: 16, italic: true, fontFace: FONTS.body,
  color: COLORS.offWhite, align: "center"
});

// ============================================
// Write file
// ============================================
pres.writeFile({ fileName: "/sessions/trusting-modest-mccarthy/mnt/Invention Tools/NEXT_30_DAYS.pptx" });
console.log("Deck created successfully!");

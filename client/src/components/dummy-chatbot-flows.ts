export type DummyChatbotFlowConnection = {
  from: string;
  to: string;
  fromHandle?: string;
  toHandle?: string;
};

export type DummyChatbotFlowNode = {
  id: string;
  nodeType:
    | "trigger"
    | "send_text"
    | "send_button"
    | "send_list"
    | "ask_question"
    | "condition";
  position: { x: number; y: number };
  data: Record<string, unknown>;
  connections: DummyChatbotFlowConnection[];
};

export type DummyChatbotFlow = {
  templateId: string;
  name: string;
  nodes: DummyChatbotFlowNode[];
};

const SYLLABUS_CHECKER_NODES: DummyChatbotFlowNode[] = [
  {
    id: "sc-trigger",
    nodeType: "trigger",
    position: { x: 40, y: 360 },
    data: {
      nodeType: "trigger",
      messageType: "text",
      keywords: [],
      fuzzyMatching: true,
      triggerSessionIds: [],
      triggerSessionId: "",
      triggerPhoneNumberId: "",
      triggerDisplayPhoneNumber: "",
      triggerConnectionType: "",
    },
    connections: [{ from: "sc-trigger", to: "sc-welcome" }],
  },
  {
    id: "sc-welcome",
    nodeType: "send_list",
    position: { x: 420, y: 220 },
    data: {
      nodeType: "send_list",
      headerType: "text",
      headerText: "Syllabus Checker",
      body: "Lost your syllabus sheet? We've got the latest info! 📚\n\nChoose a subject to get class-wise syllabus details instantly.",
      buttonText: "Select Subject",
      footer: "Sharda University",
      sections: [
        {
          title: "Subjects",
          rows: [
            { id: "physics", title: "Physics", description: "Class 11, 12 & JEE" },
            { id: "chemistry", title: "Chemistry", description: "Class 11, 12 & NEET" },
            { id: "mathematics", title: "Mathematics", description: "Class 11, 12 & JEE" },
            { id: "biology", title: "Biology", description: "Class 11, 12 & NEET" },
            { id: "accountancy", title: "Accountancy", description: "Class 11 & 12" },
            { id: "english", title: "English", description: "Class 11 & 12" },
          ],
        },
      ],
    },
    connections: [
      { from: "sc-welcome", to: "sc-physics-level", fromHandle: "list:physics" },
      { from: "sc-welcome", to: "sc-chem-level", fromHandle: "list:chemistry" },
      { from: "sc-welcome", to: "sc-math-text", fromHandle: "list:mathematics" },
      { from: "sc-welcome", to: "sc-bio-text", fromHandle: "list:biology" },
      { from: "sc-welcome", to: "sc-acc-text", fromHandle: "list:accountancy" },
      { from: "sc-welcome", to: "sc-eng-text", fromHandle: "list:english" },
    ],
  },
  {
    id: "sc-physics-level",
    nodeType: "send_button",
    position: { x: 920, y: 0 },
    data: {
      nodeType: "send_button",
      headerType: "none",
      headerText: "",
      headerUrl: "",
      body: "Which class or exam level for Physics?",
      footer: "Pick one to continue",
      buttons: [
        { id: "phy-11", text: "Class 11th" },
        { id: "phy-12", text: "Class 12th" },
        { id: "phy-jee", text: "JEE" },
      ],
    },
    connections: [
      { from: "sc-physics-level", to: "sc-physics-11", fromHandle: "button:phy-11" },
      { from: "sc-physics-level", to: "sc-physics-12", fromHandle: "button:phy-12" },
      { from: "sc-physics-level", to: "sc-physics-jee", fromHandle: "button:phy-jee" },
    ],
  },
  {
    id: "sc-physics-11",
    nodeType: "send_text",
    position: { x: 1400, y: -120 },
    data: {
      nodeType: "send_text",
      message:
        "📘 Class 11 Physics syllabus:\n• Physical World & Units\n• Kinematics\n• Laws of Motion\n• Work, Energy & Power\n• Gravitation\n• Thermodynamics\n\nReply with another subject anytime.",
    },
    connections: [],
  },
  {
    id: "sc-physics-12",
    nodeType: "send_text",
    position: { x: 1400, y: 60 },
    data: {
      nodeType: "send_text",
      message:
        "📗 Class 12 Physics syllabus:\n• Electrostatics\n• Current Electricity\n• Magnetic Effects of Current\n• Electromagnetic Induction\n• Optics\n• Modern Physics\n\nReply with another subject anytime.",
    },
    connections: [],
  },
  {
    id: "sc-physics-jee",
    nodeType: "send_text",
    position: { x: 1400, y: 240 },
    data: {
      nodeType: "send_text",
      message:
        "🎯 JEE Physics focus areas:\n• Mechanics\n• Electrostatics & Current\n• Magnetism & EMI\n• Optics & Waves\n• Modern Physics\n\nPractice numericals topic-wise. Reply with another subject anytime.",
    },
    connections: [],
  },
  {
    id: "sc-chem-level",
    nodeType: "send_button",
    position: { x: 920, y: 420 },
    data: {
      nodeType: "send_button",
      headerType: "none",
      headerText: "",
      headerUrl: "",
      body: "Which class or exam level for Chemistry?",
      footer: "Pick one to continue",
      buttons: [
        { id: "chem-11", text: "Class 11th" },
        { id: "chem-12", text: "Class 12th" },
        { id: "chem-neet", text: "NEET" },
      ],
    },
    connections: [
      { from: "sc-chem-level", to: "sc-chem-11", fromHandle: "button:chem-11" },
      { from: "sc-chem-level", to: "sc-chem-12", fromHandle: "button:chem-12" },
      { from: "sc-chem-level", to: "sc-chem-neet", fromHandle: "button:chem-neet" },
    ],
  },
  {
    id: "sc-chem-11",
    nodeType: "send_text",
    position: { x: 1400, y: 360 },
    data: {
      nodeType: "send_text",
      message:
        "🧪 Class 11 Chemistry syllabus:\n• Some Basic Concepts\n• Structure of Atom\n• Periodic Table\n• Chemical Bonding\n• States of Matter\n• Thermodynamics\n\nReply with another subject anytime.",
    },
    connections: [],
  },
  {
    id: "sc-chem-12",
    nodeType: "send_text",
    position: { x: 1400, y: 540 },
    data: {
      nodeType: "send_text",
      message:
        "🧬 Class 12 Chemistry syllabus:\n• Solid State & Solutions\n• Electrochemistry\n• Chemical Kinetics\n• d- and f-Block\n• Coordination Compounds\n• Organic: Haloalkanes to Amines\n\nReply with another subject anytime.",
    },
    connections: [],
  },
  {
    id: "sc-chem-neet",
    nodeType: "send_text",
    position: { x: 1400, y: 720 },
    data: {
      nodeType: "send_text",
      message:
        "🩺 NEET Chemistry focus areas:\n• Physical: Mole, Thermo, Equilibrium\n• Inorganic: Periodic table, p/d/f block\n• Organic: GOC, Hydrocarbons, Biomolecules\n\nReply with another subject anytime.",
    },
    connections: [],
  },
  {
    id: "sc-math-text",
    nodeType: "send_text",
    position: { x: 920, y: 820 },
    data: {
      nodeType: "send_text",
      message:
        "➗ Mathematics syllabus snapshot:\n• Sets, Relations & Functions\n• Algebra & Calculus\n• Coordinate Geometry\n• Vectors & 3D\n• Probability & Statistics\n\nReply with another subject anytime.",
    },
    connections: [],
  },
  {
    id: "sc-bio-text",
    nodeType: "send_text",
    position: { x: 920, y: 1000 },
    data: {
      nodeType: "send_text",
      message:
        "🌱 Biology syllabus snapshot:\n• Diversity of Living Organisms\n• Cell Structure & Function\n• Plant & Human Physiology\n• Genetics & Evolution\n• Ecology & Environment\n\nReply with another subject anytime.",
    },
    connections: [],
  },
  {
    id: "sc-acc-text",
    nodeType: "send_text",
    position: { x: 920, y: 1180 },
    data: {
      nodeType: "send_text",
      message:
        "📒 Accountancy syllabus snapshot:\n• Accounting for Partnership\n• Company Accounts\n• Financial Statements\n• Analysis of Financial Statements\n• Cash Flow Statement\n\nReply with another subject anytime.",
    },
    connections: [],
  },
  {
    id: "sc-eng-text",
    nodeType: "send_text",
    position: { x: 920, y: 1360 },
    data: {
      nodeType: "send_text",
      message:
        "📖 English syllabus snapshot:\n• Reading comprehension\n• Writing skills\n• Literature: prose & poetry\n• Grammar & vocabulary\n\nReply with another subject anytime.",
    },
    connections: [],
  },
];

function triggerNode(id: string, to: string, x: number, y: number): DummyChatbotFlowNode {
  return {
    id,
    nodeType: "trigger",
    position: { x, y },
    data: {
      nodeType: "trigger",
      messageType: "text",
      keywords: [],
      fuzzyMatching: true,
      triggerSessionIds: [],
      triggerSessionId: "",
      triggerPhoneNumberId: "",
      triggerDisplayPhoneNumber: "",
      triggerConnectionType: "",
    },
    connections: [{ from: id, to }],
  };
}

function askQuestionNode(
  id: string,
  message: string,
  to: string | null,
  x: number,
  y: number,
  responseFormat = "any",
): DummyChatbotFlowNode {
  return {
    id,
    nodeType: "ask_question",
    position: { x, y },
    data: {
      nodeType: "ask_question",
      message,
      responseFormat,
      validationMessage: "Please reply with a valid answer to continue.",
      retryCount: 3,
      timeoutValue: 60,
      timeoutUnit: "seconds",
      timeoutMessage: "",
      continueOnTimeout: false,
    },
    connections: to ? [{ from: id, to }] : [],
  };
}

function sendTextNode(id: string, message: string, x: number, y: number, to?: string): DummyChatbotFlowNode {
  return {
    id,
    nodeType: "send_text",
    position: { x, y },
    data: { nodeType: "send_text", message },
    connections: to ? [{ from: id, to }] : [],
  };
}

function buildMenuReplyFlow(params: {
  prefix: string;
  headerText: string;
  welcomeBody: string;
  buttonText?: string;
  options: Array<{ id: string; title: string; description?: string; reply: string }>;
}): DummyChatbotFlowNode[] {
  const { prefix, headerText, welcomeBody, buttonText = "Select option", options } = params;
  const triggerId = `${prefix}-trigger`;
  const welcomeId = `${prefix}-welcome`;
  const useButtons = options.length <= 3;
  const welcome: DummyChatbotFlowNode = useButtons
    ? {
        id: welcomeId,
        nodeType: "send_button",
        position: { x: 420, y: 220 },
        data: {
          nodeType: "send_button",
          headerType: "text",
          headerText,
          headerUrl: "",
          body: welcomeBody,
          footer: "Tap an option to continue",
          buttons: options.map((option) => ({ id: option.id, text: option.title.slice(0, 20) })),
        },
        connections: options.map((option) => ({
          from: welcomeId,
          to: `${prefix}-${option.id}`,
          fromHandle: `button:${option.id}`,
        })),
      }
    : {
        id: welcomeId,
        nodeType: "send_list",
        position: { x: 420, y: 220 },
        data: {
          nodeType: "send_list",
          headerType: "text",
          headerText,
          body: welcomeBody,
          buttonText,
          footer: "Tap an option to continue",
          sections: [
            {
              title: "Options",
              rows: options.map((option) => ({
                id: option.id,
                title: option.title.slice(0, 24),
                description: (option.description || "").slice(0, 72),
              })),
            },
          ],
        },
        connections: options.map((option) => ({
          from: welcomeId,
          to: `${prefix}-${option.id}`,
          fromHandle: `list:${option.id}`,
        })),
      };

  return [
    triggerNode(triggerId, welcomeId, 40, 280),
    welcome,
    ...options.map((option, index) =>
      sendTextNode(`${prefix}-${option.id}`, option.reply, 900, index * 180, undefined),
    ),
  ];
}

const REAL_ESTATE_HELPER_NODES: DummyChatbotFlowNode[] = [
  triggerNode("re-trigger", "re-welcome", 40, 280),
  {
    id: "re-welcome",
    nodeType: "send_button",
    position: { x: 400, y: 220 },
    data: {
      nodeType: "send_button",
      headerType: "text",
      headerText: "Real Estate Helper",
      headerUrl: "",
      body: "Hi! I can help you find or list a property.\n\nWhat would you like to do?",
      footer: "Choose one to continue",
      buttons: [
        { id: "find-properties", text: "Find Properties" },
        { id: "sell-property", text: "Sell/List Property" },
      ],
    },
    connections: [
      { from: "re-welcome", to: "re-budget", fromHandle: "button:find-properties" },
      { from: "re-welcome", to: "re-sell-type", fromHandle: "button:sell-property" },
    ],
  },
  {
    id: "re-budget",
    nodeType: "send_list",
    position: { x: 820, y: 40 },
    data: {
      nodeType: "send_list",
      headerType: "text",
      headerText: "Budget",
      body: "What is your budget range?",
      buttonText: "Select budget",
      footer: "Buyer search",
      sections: [
        {
          title: "Budget",
          rows: [
            { id: "under-50l", title: "Under 50L", description: "Starter homes" },
            { id: "50l-1cr", title: "50L - 1Cr", description: "Mid-range homes" },
            { id: "1cr-2cr", title: "1Cr - 2Cr", description: "Premium homes" },
            { id: "2cr-plus", title: "2Cr+", description: "Luxury homes" },
          ],
        },
      ],
    },
    connections: [
      { from: "re-budget", to: "re-type", fromHandle: "list:under-50l" },
      { from: "re-budget", to: "re-type", fromHandle: "list:50l-1cr" },
      { from: "re-budget", to: "re-type", fromHandle: "list:1cr-2cr" },
      { from: "re-budget", to: "re-type", fromHandle: "list:2cr-plus" },
    ],
  },
  {
    id: "re-type",
    nodeType: "send_list",
    position: { x: 1220, y: 40 },
    data: {
      nodeType: "send_list",
      headerType: "text",
      headerText: "Property type",
      body: "Which type of property are you looking for?",
      buttonText: "Select type",
      footer: "Buyer search",
      sections: [
        {
          title: "Type",
          rows: [
            { id: "apartment", title: "Apartment", description: "Flats & gated societies" },
            { id: "independent-house", title: "Independent House", description: "Villa or house" },
            { id: "plot-land", title: "Plot/Land", description: "Plots for construction" },
            { id: "commercial", title: "Commercial", description: "Office or shop space" },
          ],
        },
      ],
    },
    connections: [
      { from: "re-type", to: "re-bhk", fromHandle: "list:apartment" },
      { from: "re-type", to: "re-bhk", fromHandle: "list:independent-house" },
      { from: "re-type", to: "re-bhk", fromHandle: "list:plot-land" },
      { from: "re-type", to: "re-bhk", fromHandle: "list:commercial" },
    ],
  },
  {
    id: "re-bhk",
    nodeType: "send_list",
    position: { x: 1620, y: 40 },
    data: {
      nodeType: "send_list",
      headerType: "text",
      headerText: "Bedrooms",
      body: "How many bedrooms do you prefer?",
      buttonText: "Select BHK",
      footer: "Buyer search",
      sections: [
        {
          title: "BHK",
          rows: [
            { id: "1bhk", title: "1 BHK", description: "Compact homes" },
            { id: "2bhk", title: "2 BHK", description: "Family homes" },
            { id: "3bhk", title: "3 BHK", description: "Spacious homes" },
            { id: "4bhk", title: "4+ BHK", description: "Large homes" },
          ],
        },
      ],
    },
    connections: [
      { from: "re-bhk", to: "re-locality", fromHandle: "list:1bhk" },
      { from: "re-bhk", to: "re-locality", fromHandle: "list:2bhk" },
      { from: "re-bhk", to: "re-locality", fromHandle: "list:3bhk" },
      { from: "re-bhk", to: "re-locality", fromHandle: "list:4bhk" },
    ],
  },
  askQuestionNode("re-locality", "Which locality or area do you prefer?", "re-name", 2020, 40),
  askQuestionNode("re-name", "Please share your name so we can personalise the shortlist.", "re-phone", 2420, 40),
  askQuestionNode("re-phone", "Please share your contact number for a callback.", "re-summary", 2820, 40),
  sendTextNode(
    "re-summary",
    "🏠 Top matching properties based on your preferences:\n\n1. 2/3 BHK ready-to-move homes in your selected locality\n2. Gated society options with parking and amenities\n3. Verified listings within your budget range\n\nOur advisor will call you shortly with a shortlist. Reply anytime to start a new search.",
    3220,
    40,
  ),
  {
    id: "re-sell-type",
    nodeType: "send_button",
    position: { x: 820, y: 560 },
    data: {
      nodeType: "send_button",
      headerType: "none",
      headerText: "",
      headerUrl: "",
      body: "What type of property do you want to list?",
      footer: "Seller flow",
      buttons: [
        { id: "sell-apartment", text: "Apartment" },
        { id: "sell-house", text: "House" },
        { id: "sell-plot", text: "Plot/Land" },
      ],
    },
    connections: [
      { from: "re-sell-type", to: "re-sell-name", fromHandle: "button:sell-apartment" },
      { from: "re-sell-type", to: "re-sell-name", fromHandle: "button:sell-house" },
      { from: "re-sell-type", to: "re-sell-name", fromHandle: "button:sell-plot" },
    ],
  },
  askQuestionNode("re-sell-name", "Please share your name.", "re-sell-phone", 1220, 560),
  askQuestionNode("re-sell-phone", "Please share your contact number so our listing advisor can call you.", "re-sell-thanks", 1620, 560),
  sendTextNode(
    "re-sell-thanks",
    "Thanks! Our listing advisor will call you to collect property details, expected price, and photos.\n\nReply anytime to start again.",
    2020,
    560,
  ),
];

export const DUMMY_CHATBOT_FLOWS: Record<string, DummyChatbotFlow> = {
  "syllabus-checker": {
    templateId: "syllabus-checker",
    name: "Syllabus Checker",
    nodes: SYLLABUS_CHECKER_NODES,
  },
  "real-estate-helper": {
    templateId: "real-estate-helper",
    name: "Real Estate Helper",
    nodes: REAL_ESTATE_HELPER_NODES,
  },
  "order-support-bot": {
    templateId: "order-support-bot",
    name: "Order Support Bot",
    nodes: buildMenuReplyFlow({
      prefix: "ecom",
      headerText: "Order Support",
      welcomeBody: "Hi! How can I help with your order today?",
      buttonText: "Choose help",
      options: [
        { id: "track", title: "Track order", description: "Shipment status", reply: "Please share your order ID. We will send the latest tracking status and expected delivery date." },
        { id: "return", title: "Return item", description: "Start a return", reply: "Returns are easy. Share your order ID and the item name. We will share a pickup slot and refund timeline." },
        { id: "support", title: "Talk to support", description: "Human help", reply: "A support agent will join this chat shortly. You can also call our helpline if it is urgent." },
      ],
    }),
  },
  "test-drive-assistant": {
    templateId: "test-drive-assistant",
    name: "Test Drive Assistant",
    nodes: buildMenuReplyFlow({
      prefix: "auto",
      headerText: "Test Drive",
      welcomeBody: "Ready for a test drive? Choose a model to continue.",
      buttonText: "Select model",
      options: [
        { id: "suv", title: "SUV", description: "Family SUVs", reply: "Great choice. Please share your city and preferred date. Our dealer will confirm a test-drive slot for the SUV." },
        { id: "sedan", title: "Sedan", description: "Comfort sedans", reply: "Please share your city and preferred date. We will book a sedan test-drive with the nearest dealer." },
        { id: "ev", title: "Electric", description: "EV models", reply: "Please share your city and preferred date. An EV specialist will confirm your test-drive and charging questions." },
      ],
    }),
  },
  "it-helpdesk-bot": {
    templateId: "it-helpdesk-bot",
    name: "IT Helpdesk Bot",
    nodes: buildMenuReplyFlow({
      prefix: "it",
      headerText: "IT Helpdesk",
      welcomeBody: "What do you need help with?",
      buttonText: "Select issue",
      options: [
        { id: "password", title: "Password reset", description: "Account access", reply: "To reset your password, reply with your employee ID. We will send a reset link and ticket number." },
        { id: "vpn", title: "VPN / network", description: "Connectivity", reply: "Please try reconnecting to VPN, then reply with your location. If it still fails we will raise a network ticket." },
        { id: "laptop", title: "Laptop issue", description: "Hardware/software", reply: "Please describe the laptop issue in one line. We will create a helpdesk ticket and share next steps." },
      ],
    }),
  },
  "saas-onboarding-bot": {
    templateId: "saas-onboarding-bot",
    name: "SaaS Onboarding Bot",
    nodes: buildMenuReplyFlow({
      prefix: "saas",
      headerText: "Get started",
      welcomeBody: "Welcome! What would you like to do first?",
      buttonText: "Choose step",
      options: [
        { id: "setup", title: "Account setup", description: "Start onboarding", reply: "Let’s finish setup. Please share your work email. We will send a checklist for workspace, users, and integrations." },
        { id: "plan", title: "Choose a plan", description: "Pricing help", reply: "Starter, Growth, and Scale plans are available. Reply with your team size and we will recommend the right plan." },
        { id: "demo", title: "Book a demo", description: "Talk to success", reply: "Please share a preferred date and time. A customer success manager will confirm your product demo." },
      ],
    }),
  },
  "game-support-bot": {
    templateId: "game-support-bot",
    name: "Game Support Bot",
    nodes: buildMenuReplyFlow({
      prefix: "game",
      headerText: "Game Support",
      welcomeBody: "How can we help you in the game today?",
      buttonText: "Select help",
      options: [
        { id: "account", title: "Account login", description: "Access issues", reply: "Please share your player ID. We will send account recovery steps and freeze suspicious logins if needed." },
        { id: "rewards", title: "Rewards / coins", description: "In-game currency", reply: "Rewards usually credit within 15 minutes. Share your player ID and the offer name so we can check your wallet." },
        { id: "bug", title: "Report a bug", description: "Game issue", reply: "Please describe the bug and device type. We will create a ticket and share a workaround if one is available." },
      ],
    }),
  },
  "event-booking-bot": {
    templateId: "event-booking-bot",
    name: "Event Booking Bot",
    nodes: buildMenuReplyFlow({
      prefix: "event",
      headerText: "Events",
      welcomeBody: "Which event would you like to book?",
      buttonText: "Select event",
      options: [
        { id: "concert", title: "Concert", description: "Live music", reply: "Concert tickets are available this weekend. Reply with city and number of seats to reserve your booking." },
        { id: "comedy", title: "Comedy night", description: "Stand-up shows", reply: "Comedy night seats are filling fast. Reply with city and date preference to complete your booking." },
        { id: "movie", title: "Movie tickets", description: "Cinema bookings", reply: "Reply with movie name, city, and show time. We will share available seats and a payment link." },
      ],
    }),
  },
  "banking-assistant": {
    templateId: "banking-assistant",
    name: "Banking Assistant",
    nodes: buildMenuReplyFlow({
      prefix: "bank",
      headerText: "Banking help",
      welcomeBody: "How can we help with your banking today?",
      buttonText: "Select service",
      options: [
        { id: "card", title: "Card help", description: "Block or activate", reply: "For card help, reply BLOCK to freeze your card or ACTIVATE to enable it. Never share OTP or PIN here." },
        { id: "emi", title: "EMI / loan", description: "Due date help", reply: "Your EMI reminder is ready. Reply with the last 4 digits of the loan account to get due date and pay-now options." },
        { id: "fraud", title: "Fraud alert", description: "Urgent help", reply: "If a transaction looks unknown, reply BLOCK immediately. Our fraud desk will call you on the registered number." },
      ],
    }),
  },
  "clinic-appointment-bot": {
    templateId: "clinic-appointment-bot",
    name: "Clinic Appointment Bot",
    nodes: buildMenuReplyFlow({
      prefix: "clinic",
      headerText: "Clinic desk",
      welcomeBody: "How can we help with your visit?",
      buttonText: "Select option",
      options: [
        { id: "book", title: "Book visit", description: "New appointment", reply: "Please share patient name, preferred date, and department. We will confirm the next available slot." },
        { id: "reschedule", title: "Reschedule", description: "Change slot", reply: "Please share your appointment ID and a new preferred time. We will update the slot and send confirmation." },
        { id: "reports", title: "Lab reports", description: "Get results", reply: "Please share patient name and test date. Reports will be sent on this chat once they are ready." },
      ],
    }),
  },
};

export function getDummyChatbotFlow(templateId: string): DummyChatbotFlow | null {
  return DUMMY_CHATBOT_FLOWS[templateId] ?? null;
}

export function cloneDummyChatbotFlow(nodes: DummyChatbotFlowNode[]): DummyChatbotFlowNode[] {
  const idMap = new Map<string, string>();
  for (const node of nodes) {
    idMap.set(node.id, crypto.randomUUID());
  }

  return nodes.map((node) => {
    const nextId = idMap.get(node.id)!;
    return {
      ...node,
      id: nextId,
      data: (() => {
        const { customLabel: _ignored, ...rest } = (node.data || {}) as Record<string, unknown>;
        return { ...rest, nodeType: node.nodeType };
      })(),
      connections: node.connections.map((connection) => ({
        ...connection,
        from: idMap.get(connection.from) || connection.from,
        to: idMap.get(connection.to) || connection.to,
      })),
    };
  });
}

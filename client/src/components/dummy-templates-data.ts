import {
  Gift,
  Megaphone,
  Rocket,
  ShoppingCart,
  GraduationCap,
  Building2,
  Video,
  HeartPulse,
  Car,
  Home,
  Briefcase,
  HandHeart,
  Star,
  Bell,
  Calendar,
  Package,
  Truck,
  CreditCard,
  type LucideIcon,
} from "lucide-react";

export type DummyTemplateType = "TEXT" | "IMAGE" | "VIDEO" | "FILE";

export type DummyTemplateButton =
  | { type: "QUICK_REPLY"; text: string }
  | { type: "URL"; text: string; url: string }
  | { type: "PHONE_NUMBER"; text: string; phoneNumber: string };

export type DummyTemplate = {
  id: string;
  title: string;
  type: DummyTemplateType;
  preview: string;
  category: string;
  badge?: string;
  icon: LucideIcon;
  footer?: string;
  buttons?: DummyTemplateButton[];
};

/** Rich dummy catalog — longer bodies + buttons where useful. */
export const DUMMY_TEMPLATES: DummyTemplate[] = [
  // ——— Ecommerce ———
  {
    id: "offer_message",
    title: "Offer Message",
    type: "IMAGE",
    category: "ecommerce",
    badge: "Popular",
    icon: Gift,
    preview:
      "Hi [Name],\n\nYour cart is still waiting with your favourite picks! Complete your order in the next [Hours] hours and enjoy an exclusive [Discount]% off.\n\nUse code [CODE] at checkout. This offer is valid only on selected items and cannot be combined with other coupons.\n\nNeed help? Reply to this chat and our support team will assist you.",
    footer: "Offer valid for a limited time",
    buttons: [
      { type: "URL", text: "Complete Order", url: "https://example.com/checkout" },
      { type: "QUICK_REPLY", text: "Remind me later" },
    ],
  },
  {
    id: "order_cancelled",
    title: "Order Cancelled",
    type: "TEXT",
    category: "ecommerce",
    icon: Package,
    preview:
      "Hi [Name],\n\nYour order #[OrderID] has been cancelled as requested.\n\nRefund of [Amount] will be credited to your original payment method within 5–7 business days. You will receive a separate confirmation once the refund is processed.\n\nIf you did not request this cancellation, please contact us immediately.",
    footer: "Thank you for shopping with us",
    buttons: [
      { type: "QUICK_REPLY", text: "Track refund" },
      { type: "QUICK_REPLY", text: "Talk to support" },
      { type: "PHONE_NUMBER", text: "Call Support", phoneNumber: "918850052662" },
    ],
  },
  {
    id: "cod_to_prepaid",
    title: "C.O.D to Prepaid",
    type: "IMAGE",
    category: "ecommerce",
    icon: CreditCard,
    preview:
      "Hi [Name],\n\nSwitch your COD order #[OrderID] to prepaid and unlock:\n• Free shipping\n• Extra [Discount]% off\n• Priority dispatch within 24 hours\n\nPay securely now and save [Amount] on this order. The link expires in [Hours] hours.",
    footer: "Secure payment powered by us",
    buttons: [
      { type: "URL", text: "Pay Now", url: "https://example.com/pay" },
      { type: "QUICK_REPLY", text: "Keep as COD" },
    ],
  },
  {
    id: "delivery_tracking",
    title: "Delivery Tracking",
    type: "TEXT",
    category: "ecommerce",
    icon: Truck,
    preview:
      "Hi [Name],\n\nGreat news — your order #[OrderID] is out for delivery!\n\nCourier: [Courier]\nExpected by: [Date]\nTracking ID: [TrackingId]\n\nPlease keep your phone reachable. If you miss the attempt, we will reschedule automatically.",
    footer: "Track anytime from the link below",
    buttons: [
      { type: "URL", text: "Track Package", url: "https://example.com/track" },
      { type: "QUICK_REPLY", text: "Reschedule" },
      { type: "QUICK_REPLY", text: "Change address" },
    ],
  },
  {
    id: "order_upsell",
    title: "Order + Upsell",
    type: "IMAGE",
    category: "ecommerce",
    icon: ShoppingCart,
    preview:
      "Thanks for shopping with us, [Name]!\n\nCustomers who bought [Item] also loved [SuggestedItem]. Add it now and get [Discount]% off as a thank-you for being a valued customer.\n\nThis personalized offer is available only until [Date]. Tap below to add it to your next order in one click.",
    footer: "Handpicked recommendations for you",
    buttons: [
      { type: "URL", text: "Add to Cart", url: "https://example.com/upsell" },
      { type: "QUICK_REPLY", text: "Not interested" },
    ],
  },
  {
    id: "new_product_launch",
    title: "New Product Launch",
    type: "FILE",
    category: "ecommerce",
    badge: "NEW",
    icon: Rocket,
    preview:
      "Hey [Name]!\n\nIntroducing [Product] — designed for customers like you.\n\nLaunch highlights:\n• Special launch price: [Price]\n• Early-bird bonus: [Bonus]\n• Free delivery on first 500 orders\n\nBe among the first to experience it. Brochure attached for full specs.",
    footer: "Limited launch stock available",
    buttons: [
      { type: "URL", text: "Pre-order Now", url: "https://example.com/launch" },
      { type: "QUICK_REPLY", text: "Notify me" },
    ],
  },
  {
    id: "product_details",
    title: "Product Details",
    type: "IMAGE",
    category: "ecommerce",
    icon: Package,
    preview:
      "Hi [Name],\n\nHere’s everything about [Product]:\n\n[Details]\n\nPrice: [Price]\nAvailable colours/sizes: [Variants]\nDelivery estimate: [DeliveryDays] days\n\nReply with your preferred variant or tap below to place an order. Our experts can also help you choose the right option.",
    footer: "Ask us anything on this chat",
    buttons: [
      { type: "QUICK_REPLY", text: "Buy now" },
      { type: "QUICK_REPLY", text: "More details" },
      { type: "PHONE_NUMBER", text: "Call Expert", phoneNumber: "918850052662" },
    ],
  },
  {
    id: "birthday_promotion",
    title: "Birthday Promotion",
    type: "TEXT",
    category: "ecommerce",
    icon: Gift,
    preview:
      "Happy Birthday [Name]! 🎂\n\nWe’re celebrating you with a special gift: [Discount]% off your next order.\n\nCode: [BDAY]\nValid till: [Date]\nMin. order: [MinOrder]\n\nTreat yourself — you deserve it. This birthday surprise is exclusive to your account.",
    footer: "Wishing you an amazing year ahead",
    buttons: [
      { type: "URL", text: "Shop Birthday Deals", url: "https://example.com/bday" },
      { type: "QUICK_REPLY", text: "Thanks!" },
    ],
  },
  {
    id: "loyalty_program",
    title: "Loyalty Program",
    type: "TEXT",
    category: "ecommerce",
    icon: Star,
    preview:
      "Hi [Name],\n\nYou’ve earned [Points] loyalty points — enough to unlock rewards worth [RewardValue]!\n\nRedeem them before [Date] on your next purchase. Points never expire for Premium members.\n\nYour current tier: [Tier]\nPoints to next tier: [NextTierPoints]",
    footer: "Loyalty rewards made simple",
    buttons: [
      { type: "URL", text: "Redeem Points", url: "https://example.com/loyalty" },
      { type: "QUICK_REPLY", text: "View catalogue" },
    ],
  },
  {
    id: "diwali_offer",
    title: "Diwali Offer Message",
    type: "TEXT",
    category: "ecommerce",
    icon: Megaphone,
    preview:
      "Happy Diwali [Name]!\n\nLight up your festivities with our biggest sale of the year — up to [Discount]% off sitewide plus free gifts on orders above [MinOrder].\n\nFestive deals end on [Date]. Shop early for best stock availability across electronics, fashion, and home.\n\nMay this Diwali bring joy and prosperity to you and your family.",
    footer: "Festival sale — while stocks last",
    buttons: [
      { type: "URL", text: "Shop Diwali Sale", url: "https://example.com/diwali" },
      { type: "QUICK_REPLY", text: "Send wishlist ideas" },
    ],
  },
  {
    id: "limited_time_sale",
    title: "Limited Time Sale",
    type: "VIDEO",
    category: "ecommerce",
    badge: "5X RECOVERY",
    icon: Megaphone,
    preview:
      "Flash sale alert [Name]!\n\nUp to [Discount]% off ends in just [Hours] hours. Best-sellers are selling out fast.\n\nWhat’s live right now:\n• Daily deals under [Price]\n• Buy 2 Get 1 on select categories\n• Extra bank offers at checkout\n\nDon’t wait — once the timer hits zero, prices go back up.",
    footer: "Ends soon — shop before it’s gone",
    buttons: [
      { type: "URL", text: "Shop Flash Sale", url: "https://example.com/flash" },
      { type: "QUICK_REPLY", text: "Show top deals" },
    ],
  },
  {
    id: "cross_sell",
    title: "Cross Sell Message",
    type: "TEXT",
    category: "ecommerce",
    icon: ShoppingCart,
    preview:
      "Hi [Name],\n\nSince you bought [Item], you might love [SuggestedItem] — a perfect match based on thousands of customer reviews.\n\nBundle both together and save [Amount] today. Over [ReviewCount]+ buyers rated this combo 4.5★ or higher.\n\nOffer valid until [Date]. Tap below to view the bundle.",
    footer: "Recommended based on your purchase",
    buttons: [
      { type: "URL", text: "View Bundle", url: "https://example.com/bundle" },
      { type: "QUICK_REPLY", text: "Maybe later" },
    ],
  },

  // ——— Education ———
  {
    id: "fee_reminder",
    title: "Fee Reminder",
    type: "TEXT",
    category: "education",
    icon: Bell,
    preview:
      "Dear [Parent],\n\nThis is a friendly reminder that the fee of [Amount] for [Student] ([Class]) is due on [Date].\n\nPayment modes: UPI, Net Banking, Card, or campus cash counter.\nLate fee of [LateFee] may apply after the due date.\n\nIf you have already paid, please ignore this message and share the receipt on this chat for our records.",
    footer: "Accounts department",
    buttons: [
      { type: "URL", text: "Pay Fees Online", url: "https://example.com/fees" },
      { type: "QUICK_REPLY", text: "Already paid" },
      { type: "PHONE_NUMBER", text: "Call Accounts", phoneNumber: "918850052662" },
    ],
  },
  {
    id: "result_announcement",
    title: "Result Announcement",
    type: "TEXT",
    category: "education",
    icon: GraduationCap,
    preview:
      "Dear [Name],\n\nResults for [Exam] ([Session]) are now available.\n\nYou can download your scorecard using your roll number [RollNo] from the student portal. Please review subject-wise marks carefully and contact the exam cell within [Days] days for any discrepancy.\n\nCongratulations to all students on completing this milestone!",
    footer: "Examination cell",
    buttons: [
      { type: "URL", text: "View Results", url: "https://example.com/results" },
      { type: "QUICK_REPLY", text: "Request recheck" },
    ],
  },
  {
    id: "holiday_announcement",
    title: "Holiday Announcement",
    type: "TEXT",
    category: "education",
    icon: Calendar,
    preview:
      "Dear Parents,\n\nSchool will remain closed on [Date] on account of [Reason].\n\nRegular classes will resume on [ResumeDate]. Hostel students should plan travel accordingly. Transport services will not operate on the holiday.\n\nPlease check the school app for any updates related to assignments or online make-up sessions.",
    footer: "Principal’s office",
    buttons: [
      { type: "QUICK_REPLY", text: "Acknowledged" },
      { type: "URL", text: "School Calendar", url: "https://example.com/calendar" },
    ],
  },
  {
    id: "admission_invite",
    title: "Admission Invite",
    type: "IMAGE",
    category: "education",
    badge: "NEW",
    icon: Megaphone,
    preview:
      "Hi [Name],\n\nAdmissions for academic year [Year] are open at [School]!\n\nWhy families choose us:\n• Experienced faculty & modern labs\n• Strong academics with sports & arts\n• Safe campus with transport facility\n\nApplication deadline: [Date]\nCampus visit slots: [VisitSlots]\n\nBook a counselling session or apply online today. Limited seats for [Grade].",
    footer: "Admissions open — apply early",
    buttons: [
      { type: "URL", text: "Apply Now", url: "https://example.com/admission" },
      { type: "QUICK_REPLY", text: "Book campus visit" },
      { type: "PHONE_NUMBER", text: "Call Admissions", phoneNumber: "918850052662" },
    ],
  },
  {
    id: "class_reschedule",
    title: "Class Reschedule",
    type: "TEXT",
    category: "education",
    icon: Calendar,
    preview:
      "Dear [Name],\n\nYour [Subject] class originally scheduled for [OldDate] at [OldTime] has been rescheduled.\n\nNew schedule:\nDate: [NewDate]\nTime: [NewTime]\nMode: [Mode]\nFaculty: [Faculty]\n\nPlease join using the updated link. Attendance will be marked only for the new slot. Contact your coordinator if you have a clash.",
    footer: "Academic coordination desk",
    buttons: [
      { type: "URL", text: "Join Class", url: "https://example.com/class" },
      { type: "QUICK_REPLY", text: "Cannot attend" },
    ],
  },

  // ——— Banking ———
  {
    id: "credit_score",
    title: "Credit Score Check",
    type: "TEXT",
    category: "banking",
    icon: CreditCard,
    preview:
      "Hi [Name],\n\nYour latest credit score report is ready.\n\nScore range insights and key factors affecting your score are available in the full report. Checking your score through us does not impact your credit rating.\n\nReview recommendations to improve your score and unlock better loan & card offers tailored for you.",
    footer: "Free credit health check",
    buttons: [
      { type: "URL", text: "View Full Report", url: "https://example.com/credit" },
      { type: "QUICK_REPLY", text: "Improve my score" },
    ],
  },
  {
    id: "fraud_alert",
    title: "Fraud Alert",
    type: "TEXT",
    category: "banking",
    badge: "Most Used",
    icon: Bell,
    preview:
      "ALERT [Name],\n\nWe detected a transaction of [Amount] on your card ending [XXXX] at [Merchant] on [Date] at [Time].\n\nIf this was you, no action is needed.\nIf this wasn’t you, block the card immediately and report the transaction. Our fraud desk is available 24×7.",
    footer: "Do not share OTP or card details with anyone",
    buttons: [
      { type: "QUICK_REPLY", text: "This was me" },
      { type: "QUICK_REPLY", text: "Block card" },
      { type: "PHONE_NUMBER", text: "Fraud Helpline", phoneNumber: "918850052662" },
    ],
  },
  {
    id: "emi_reminder_bank",
    title: "EMI Reminder",
    type: "TEXT",
    category: "banking",
    icon: CreditCard,
    preview:
      "Hi [Name],\n\nYour EMI of [Amount] for [Loan] (A/C [Account]) is due on [Date].\n\nPlease ensure sufficient balance in your registered account to avoid bounce charges of [BounceFee]. You can also pay online instantly.\n\nOutstanding principal: [Principal]\nEMIs remaining: [Remaining]",
    footer: "Auto-debit will be attempted on due date",
    buttons: [
      { type: "URL", text: "Pay EMI", url: "https://example.com/emi" },
      { type: "QUICK_REPLY", text: "Already paid" },
      { type: "PHONE_NUMBER", text: "Loan Desk", phoneNumber: "918850052662" },
    ],
  },

  // ——— Webinar ———
  {
    id: "web_reminder_30",
    title: "Web Reminder 30 mins",
    type: "TEXT",
    category: "webinar",
    icon: Bell,
    preview:
      "Hi [Name],\n\nYour webinar “[Topic]” starts in 30 minutes.\n\nHost: [Speaker]\nDuration: [Duration]\nPlatform: [Platform]\n\nPlease join 5 minutes early to test audio/video. The session will be recorded and shared with registered attendees within 24 hours.",
    footer: "See you inside!",
    buttons: [
      { type: "URL", text: "Join Webinar", url: "https://example.com/webinar" },
      { type: "QUICK_REPLY", text: "Cannot join" },
    ],
  },
  {
    id: "webinar_confirmation",
    title: "Webinar Confirmation",
    type: "TEXT",
    category: "webinar",
    icon: Video,
    preview:
      "You’re registered, [Name]!\n\nWebinar: “[Topic]”\nDate: [Date]\nTime: [Time] ([Timezone])\nSpeaker: [Speaker]\n\nAdd this to your calendar so you don’t miss it. You’ll receive a reminder 30 minutes before start. Feel free to submit questions in advance.",
    footer: "Registration confirmed",
    buttons: [
      { type: "URL", text: "Add to Calendar", url: "https://example.com/calendar-ics" },
      { type: "QUICK_REPLY", text: "Submit a question" },
    ],
  },
  {
    id: "webinar_invite",
    title: "Webinar Invite",
    type: "IMAGE",
    category: "webinar",
    icon: Megaphone,
    preview:
      "Hi [Name],\n\nYou’re invited to “[Topic]” with [Speaker] on [Date] at [Time].\n\nWhat you’ll learn:\n• [Takeaway1]\n• [Takeaway2]\n• [Takeaway3]\n\nSeats are limited. Reserve your free seat now and get access to bonus resources after the session.",
    footer: "Free registration — limited seats",
    buttons: [
      { type: "URL", text: "Reserve Seat", url: "https://example.com/register" },
      { type: "QUICK_REPLY", text: "Tell me more" },
    ],
  },

  // ——— Healthcare ———
  {
    id: "checkup_reminder",
    title: "Checkup Reminder",
    type: "TEXT",
    category: "healthcare",
    icon: Calendar,
    preview:
      "Hi [Name],\n\nReminder: Your checkup with Dr. [Doctor] ([Department]) is scheduled on [Date] at [Time] at [Clinic].\n\nPlease arrive 15 minutes early with previous reports and a valid ID. Fasting may be required for [TestName] — follow the prep instructions shared earlier.\n\nReply CONFIRM to confirm, or reschedule if needed.",
    footer: "Your health matters to us",
    buttons: [
      { type: "QUICK_REPLY", text: "Confirm" },
      { type: "QUICK_REPLY", text: "Reschedule" },
      { type: "PHONE_NUMBER", text: "Call Clinic", phoneNumber: "918850052662" },
    ],
  },
  {
    id: "welcome_message_health",
    title: "Welcome Message",
    type: "TEXT",
    category: "healthcare",
    icon: HeartPulse,
    preview:
      "Welcome to [Clinic], [Name]!\n\nWe’re glad to have you on your health journey with us. You can book appointments, request reports, and get prescription refills right here on WhatsApp.\n\nOur care team is available [Hours]. For emergencies, please call the helpline immediately instead of messaging.",
    footer: "Patient care desk",
    buttons: [
      { type: "QUICK_REPLY", text: "Book appointment" },
      { type: "QUICK_REPLY", text: "Talk to doctor" },
      { type: "URL", text: "Patient Portal", url: "https://example.com/patient" },
    ],
  },
  {
    id: "medical_emergency",
    title: "Medical Emergency",
    type: "TEXT",
    category: "healthcare",
    icon: Bell,
    preview:
      "URGENT: [Name],\n\nPlease contact [Clinic] immediately regarding your recent reports for [TestName]. A doctor needs to discuss next steps with you at the earliest.\n\nThis message is time-sensitive. If you are experiencing severe symptoms, visit the nearest emergency facility or call emergency services.",
    footer: "Urgent care notification",
    buttons: [
      { type: "PHONE_NUMBER", text: "Call Now", phoneNumber: "918850052662" },
      { type: "QUICK_REPLY", text: "I will call back" },
    ],
  },
  {
    id: "bill_reminder_health",
    title: "Bill reminder",
    type: "TEXT",
    category: "healthcare",
    icon: CreditCard,
    preview:
      "Hi [Name],\n\nYour medical bill of [Amount] for services on [ServiceDate] (Invoice #[Invoice]) is pending.\n\nYou can pay securely online or at the billing counter. Insurance claims, if applicable, are already adjusted in the amount shown.\n\nPlease clear dues by [DueDate] to avoid service interruptions on follow-up visits.",
    footer: "Billing department",
    buttons: [
      { type: "URL", text: "Pay Bill", url: "https://example.com/bill" },
      { type: "QUICK_REPLY", text: "Need invoice copy" },
    ],
  },
  {
    id: "healthcare_discounts",
    title: "Healthcare Discounts",
    type: "IMAGE",
    category: "healthcare",
    badge: "NEW",
    icon: Gift,
    preview:
      "Hi [Name],\n\nThis month, enjoy [Discount]% off on health packages at [Clinic]:\n• Full body checkup\n• Cardiac screening\n• Diabetes care package\n\nBook before [Date] to lock in the offer. Packages include doctor consultation and digital reports within [ReportHours] hours.",
    footer: "Preventive care made affordable",
    buttons: [
      { type: "URL", text: "Book Package", url: "https://example.com/packages" },
      { type: "QUICK_REPLY", text: "Call me back" },
    ],
  },

  // ——— Automobile ———
  {
    id: "test_drive",
    title: "Test Drive Reminder",
    type: "TEXT",
    category: "automobile",
    icon: Car,
    preview:
      "Hi [Name],\n\nYour test drive for [Model] is scheduled on [Date] at [Time] at [Location].\n\nPlease bring a valid driving licence. Our product specialist will walk you through features, variants, and current exchange offers.\n\nIf you need to reschedule, reply at least 4 hours before the slot.",
    footer: "We look forward to seeing you",
    buttons: [
      { type: "QUICK_REPLY", text: "On my way" },
      { type: "QUICK_REPLY", text: "Reschedule" },
      { type: "URL", text: "Directions", url: "https://example.com/maps" },
    ],
  },
  {
    id: "car_emi",
    title: "Car EMI Reminder",
    type: "TEXT",
    category: "automobile",
    icon: CreditCard,
    preview:
      "Hi [Name],\n\nEMI of [Amount] for your [Model] (Loan #[LoanId]) is due on [Date].\n\nPlease ensure funds are available or pay online to avoid late fees. For foreclosure quotes or statement requests, use the options below.\n\nNext service reminder for your vehicle: [ServiceDate].",
    footer: "Auto finance desk",
    buttons: [
      { type: "URL", text: "Pay EMI", url: "https://example.com/car-emi" },
      { type: "QUICK_REPLY", text: "Need statement" },
    ],
  },
  {
    id: "sales_event",
    title: "Sales Event Invite",
    type: "IMAGE",
    category: "automobile",
    icon: Megaphone,
    preview:
      "Hi [Name],\n\nJoin our exclusive [Brand] sales event on [Date] at [Venue]!\n\nHighlights:\n• Special exchange bonus up to [Bonus]\n• Low-interest finance from [Rate]%\n• Free accessories worth [GiftValue]\n• On-spot delivery on select models\n\nRSVP to reserve a priority slot with our sales consultant.",
    footer: "Exclusive invite for selected customers",
    buttons: [
      { type: "QUICK_REPLY", text: "I’ll attend" },
      { type: "URL", text: "Event Details", url: "https://example.com/event" },
      { type: "PHONE_NUMBER", text: "Talk to Sales", phoneNumber: "918850052662" },
    ],
  },

  // ——— Real Estate ———
  {
    id: "real_estate_showcase",
    title: "Real Estate Showcase",
    type: "IMAGE",
    category: "real-estate",
    badge: "Popular",
    icon: Home,
    preview:
      "Hi [Name],\n\nExplore premium homes at [Project], [Location].\n\n• Configurations: [Configs]\n• Starting price: [Price]\n• Possession: [Possession]\n• Amenities: clubhouse, pool, landscaped parks & 24×7 security\n\nBook a complimentary site visit this weekend and get a detailed price sheet with payment plans.",
    footer: "RERA registered project",
    buttons: [
      { type: "URL", text: "View Project", url: "https://example.com/project" },
      { type: "QUICK_REPLY", text: "Book site visit" },
      { type: "PHONE_NUMBER", text: "Call Advisor", phoneNumber: "918850052662" },
    ],
  },
  {
    id: "property_promotion",
    title: "Property Promotion",
    type: "TEXT",
    category: "real-estate",
    badge: "NEW",
    icon: Megaphone,
    preview:
      "Hi [Name],\n\nLimited units left at [Project]! Starting [Price] with flexible payment plans and attractive bank tie-ups.\n\nThis weekend only: waived booking amount + free modular kitchen upgrade on 2 & 3 BHK inventory.\n\nSchedule a tour with our relationship manager and get a personalized inventory shortlist based on your budget [Budget].",
    footer: "Offer valid this weekend only",
    buttons: [
      { type: "QUICK_REPLY", text: "Schedule tour" },
      { type: "URL", text: "Download Brochure", url: "https://example.com/brochure" },
    ],
  },

  // ——— Services ———
  {
    id: "job_alerts",
    title: "Job Alerts",
    type: "TEXT",
    category: "services",
    icon: Briefcase,
    preview:
      "Hey [Name],\n\nYour profile matches [Role] at [Company] ([Location]).\n\nExperience required: [Experience]\nCTC range: [CTC]\nNotice period preferred: [Notice]\n\nSoft deadline to apply: [Date]. Tap below to view the full JD and submit your application in minutes.",
    footer: "Jobs matched to your profile",
    buttons: [
      { type: "URL", text: "Apply Now", url: "https://example.com/jobs" },
      { type: "QUICK_REPLY", text: "Not interested" },
      { type: "QUICK_REPLY", text: "Update my resume" },
    ],
  },
  {
    id: "gym_welcome",
    title: "Gym welcome message",
    type: "TEXT",
    category: "services",
    icon: HeartPulse,
    preview:
      "Welcome to [Gym], [Name]!\n\nYour membership starts [Date] ([Plan]).\n\nGetting started:\n1. Complete your fitness assessment\n2. Meet your trainer for a starter plan\n3. Download the app for class bookings\n\nGym hours: [Hours]. Reply PLAN to see today’s class schedule or book a personal training trial.",
    footer: "Let’s crush your fitness goals",
    buttons: [
      { type: "QUICK_REPLY", text: "View class plan" },
      { type: "QUICK_REPLY", text: "Book PT trial" },
      { type: "URL", text: "Member App", url: "https://example.com/gym-app" },
    ],
  },
  {
    id: "food_delivered",
    title: "Food delivered",
    type: "TEXT",
    category: "services",
    icon: Package,
    preview:
      "Hi [Name],\n\nYour order from [Restaurant] (Order #[OrderID]) was delivered. Enjoy your meal!\n\nIf anything is missing or incorrect, report within [Minutes] minutes for a quick resolution. Rate your experience to help us improve — it takes under 10 seconds.",
    footer: "Bon appétit!",
    buttons: [
      { type: "QUICK_REPLY", text: "Rate 5★" },
      { type: "QUICK_REPLY", text: "Report an issue" },
      { type: "URL", text: "Reorder", url: "https://example.com/reorder" },
    ],
  },

  // ——— Non-profit ———
  {
    id: "blood_donation",
    title: "Blood Donation",
    type: "TEXT",
    category: "non-profit",
    badge: "NEW",
    icon: HandHeart,
    preview:
      "Hey [Name],\n\nIt’s time to save lives! Join our blood donation drive on [Date] from [StartTime]–[EndTime] at [Venue].\n\nEligibility: age 18–65, weight 45kg+, good health. Please eat a light meal and carry a photo ID.\n\nEvery unit can help up to 3 patients. Walk-ins welcome; priority slots for pre-registered donors.",
    footer: "Donate blood. Share life.",
    buttons: [
      { type: "QUICK_REPLY", text: "I’ll donate" },
      { type: "URL", text: "Register Slot", url: "https://example.com/donate" },
      { type: "QUICK_REPLY", text: "Share with friends" },
    ],
  },
  {
    id: "ngo_optin",
    title: "NGO Optin",
    type: "TEXT",
    category: "non-profit",
    icon: HandHeart,
    preview:
      "Hi [Name],\n\nThanks for supporting [NGO]! Reply YES to receive campaign updates, volunteer opportunities, and impact stories from the field.\n\nYou can unsubscribe anytime by replying STOP. We send only meaningful updates — typically 1–2 messages per week.",
    footer: "Together for a better tomorrow",
    buttons: [
      { type: "QUICK_REPLY", text: "YES" },
      { type: "QUICK_REPLY", text: "STOP" },
      { type: "URL", text: "Our Work", url: "https://example.com/ngo" },
    ],
  },
  {
    id: "inviting_volunteers",
    title: "Inviting Volunteers",
    type: "IMAGE",
    category: "non-profit",
    icon: HandHeart,
    preview:
      "Hi [Name],\n\nWe need volunteers for [Cause] on [Date] at [Venue] ([Hours] hours).\n\nRoles available: registration desk, crowd guidance, kit distribution, and photography.\n\nNo prior experience needed — training will be provided on-site. Meals and a certificate of appreciation are included. Sign up and bring a friend!",
    footer: "Every hand counts",
    buttons: [
      { type: "URL", text: "Volunteer Sign-up", url: "https://example.com/volunteer" },
      { type: "QUICK_REPLY", text: "I can help" },
      { type: "PHONE_NUMBER", text: "Coordinator", phoneNumber: "918850052662" },
    ],
  },

  // ——— General / Trending / Top rated ———
  {
    id: "increase_referrals",
    title: "Increase Referrals",
    type: "TEXT",
    category: "general",
    icon: Star,
    preview:
      "Hi [Name],\n\nLove shopping with us? Share your referral code [Code] with friends.\n\nYou get [Reward] for every successful referral, and your friend gets [FriendReward] on their first order. There’s no limit to how many friends you can refer this month.\n\nShare now and start earning rewards instantly.",
    footer: "Referral rewards credited after delivery",
    buttons: [
      { type: "QUICK_REPLY", text: "Share my code" },
      { type: "URL", text: "Referral Dashboard", url: "https://example.com/refer" },
    ],
  },
  {
    id: "festive_wishes",
    title: "Festive Wishes",
    type: "IMAGE",
    category: "general",
    icon: Gift,
    preview:
      "Hi [Name],\n\nWe wish you a very happy [Festival]!\n\nMay this season bring health, happiness, and success to you and your loved ones. The entire [Brand] family is grateful for your continued trust.\n\nExplore our festive collection with exclusive gifts and surprises waiting for you.",
    footer: "Warm wishes from our team",
    buttons: [
      { type: "URL", text: "Festive Collection", url: "https://example.com/festive" },
      { type: "QUICK_REPLY", text: "Thank you" },
    ],
  },
  {
    id: "abandoned_cart",
    title: "Holi Abandoned Cart",
    type: "IMAGE",
    category: "trending",
    badge: "5X RECOVERY",
    icon: ShoppingCart,
    preview:
      "Hi [Name],\n\nYour Holi cart is still waiting with festive picks! Complete checkout in the next [Hours] hours and save an extra [Discount]%.\n\nItems reserved in your cart may sell out during peak festive rush. We’ve applied the best available offers automatically — just finish payment to confirm.\n\nNeed a different colour or size? Reply here and we’ll help instantly.",
    footer: "Holi special — limited stock",
    buttons: [
      { type: "URL", text: "Complete Checkout", url: "https://example.com/cart" },
      { type: "QUICK_REPLY", text: "Modify cart" },
      { type: "QUICK_REPLY", text: "Need help" },
    ],
  },
  {
    id: "event_invite",
    title: "Event Invite",
    type: "TEXT",
    category: "trending",
    icon: Calendar,
    preview:
      "You’re invited, [Name]!\n\nJoin us for [Event] on [Date] at [Venue] from [StartTime] onwards.\n\nDress code: [DressCode]\nParking: available on-site\nPlus-ones: welcome (please RSVP count)\n\nKindly confirm your attendance so we can arrange seating and hospitality. We can’t wait to celebrate with you!",
    footer: "RSVP appreciated",
    buttons: [
      { type: "QUICK_REPLY", text: "I’ll attend" },
      { type: "QUICK_REPLY", text: "Cannot make it" },
      { type: "URL", text: "Event Info", url: "https://example.com/rsvp" },
    ],
  },
  {
    id: "top_offer",
    title: "Top Rated Offer",
    type: "TEXT",
    category: "top-rated",
    badge: "Most Popular",
    icon: Star,
    preview:
      "Hi [Name],\n\nOur best-rated deal is live — [Offer] for just [Price] (was [OldPrice]).\n\nRated [Rating]★ by [ReviewCount]+ customers. Includes free delivery and easy 7-day returns.\n\nGrab it before [Date]. Once the deal quota ends, the price returns to normal without notice.",
    footer: "Customer favourite this week",
    buttons: [
      { type: "URL", text: "Grab Deal", url: "https://example.com/top-deal" },
      { type: "QUICK_REPLY", text: "See reviews" },
      { type: "QUICK_REPLY", text: "Remind me" },
    ],
  },
];

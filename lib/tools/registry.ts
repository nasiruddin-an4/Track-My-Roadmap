/*
 * The free tools: names, page copy, how-to steps, FAQs and where each one points people next.
 * The /tools page, every tool page, the sitemap and llms.txt are all built from this list.
 */

export type ToolGroup = "forms" | "templates" | "study" | "images" | "pdf" | "bangla";

/** In the order the /tools page shows them. `short` is the filter chip's label. */
export const TOOL_GROUPS: { key: ToolGroup; title: string; short: string; text: string }[] = [
  { key: "forms", title: "Photos for forms", short: "Form photos", text: "Exact sizes and KB limits for job, admission and passport forms." },
  { key: "pdf", title: "PDF tools", short: "PDF", text: "Merge, split, shrink and number PDFs, or turn pages into pictures." },
  { key: "images", title: "Image tools", short: "Images", text: "Shrink, convert and combine pictures for uploads." },
  { key: "templates", title: "Letters and documents", short: "Documents", text: "Ready-to-print applications, a cover letter and cover pages, in English or Bangla." },
  { key: "bangla", title: "Bangla", short: "Bangla", text: "Bijoy and Unicode Bengali text." },
  { key: "study", title: "AI helpers", short: "AI", text: "Turn handwriting into text, a summary or a quiz." },
];

/** Shown first on the /tools page. */
export const POPULAR_TOOLS = ["photo-signature-resizer", "compress-image", "merge-pdf", "compress-pdf"];

export type Tool = {
  slug: string;
  /** short name on cards and in the breadcrumb */
  name: string;
  /** the page's <title> and share title (" | Track My Roadmap" is added) */
  title: string;
  /** search-result description */
  description: string;
  /** the heading on the tool's page */
  heading: string;
  /** one line for cards */
  summary: string;
  /** the same in Bengali */
  bn: string;
  group: ToolGroup;
  keywords: string[];
  steps: string[];
  faq: [string, string][];
  /** where someone might want to go after using the tool */
  next: { href: string; label: string; text: string };
  /** false when the tool sends something to a server (the AI note reader); every other tool runs on the device */
  onDevice?: boolean;
};

const PRIVATE = "No. Everything happens in your browser, on your own phone or computer. Your files are never uploaded to our server, so nobody else can see them.";
const PRIVATE_DOC = "No. The document is put together in your browser. Your name, school and roll are remembered on this device only, so you don’t have to type them again.";

export const TOOLS: Tool[] = [
  {
    slug: "photo-signature-resizer",
    name: "Photo & signature resizer",
    title: "Photo and Signature Resizer for Job and Admission Forms (300×300, 300×80)",
    description: "Resize your photo to 300×300 under 100 KB and your signature to 300×80 under 60 KB for Teletalk government job forms, Dhaka University admission and more. Free, and your files stay on your phone.",
    heading: "Photo and signature resizer",
    summary: "Exact pixel size and KB limit for job and admission forms.",
    bn: "চাকরি ও ভর্তির আবেদনের জন্য ছবি ও স্বাক্ষর রিসাইজ করুন",
    group: "forms",
    keywords: ["photo resizer 300x300", "signature resizer 300x80", "teletalk photo size", "photo resize 100kb", "signature 60kb", "passport photo", "job application photo", "crop", "ছবি রিসাইজ", "স্বাক্ষর রিসাইজ", "পাসপোর্ট ছবি"],
    steps: [
      "Choose Photo or Signature, then the form you’re applying to. Not listed? Pick Custom and type the size from your circular.",
      "Add your picture. Drag it to centre your face (or signature) and zoom with the slider.",
      "Download. The file is already the exact pixel size and under the KB limit.",
    ],
    faq: [
      ["What size do government job forms want?", "Most government job forms on teletalk.com.bd ask for a 300 × 300 pixel photo up to 100 KB and a 300 × 80 pixel signature up to 60 KB, both as JPG. Circulars can differ, so check yours; if it asks for something else, use Custom."],
      ["My signature photo has a grey background. Can I fix it?", "Yes. Turn on Clean background: the paper and shadows become white and the ink stays dark. If thin strokes start to disappear, lower the strength."],
      ["Are my photos uploaded anywhere?", PRIVATE],
      ["Why is the photo exactly the size I chose, even if my picture is a different shape?", "Forms reject photos that aren’t the exact size. The frame shows what will be kept; drag and zoom so the important part is inside it."],
    ],
    next: { href: "/cv", label: "Build your CV", text: "Applying for a job? Build an ATS-friendly CV next, free." },
  },
  {
    slug: "leave-application",
    name: "Leave application",
    title: "Leave Application for School and College, in English and Bangla",
    description: "Write a leave application to your headmaster or principal in English or Bangla. Fill in your class, roll, dates and reason, then print it, save it as a PDF or download it for Word. Free.",
    heading: "Leave application",
    summary: "Sick leave or family reasons, in English or Bangla.",
    bn: "ছুটির আবেদনপত্র, বাংলা ও ইংরেজিতে",
    group: "templates",
    keywords: ["leave application", "leave application for school", "sick leave application", "ছুটির আবেদনপত্র", "ছুটির দরখাস্ত"],
    steps: [
      "Choose English or বাংলা, then your school or college.",
      "Fill in the dates, the reason and your class and roll. The letter writes itself as you type.",
      "Print it, save it as a PDF, or download it to edit in Word.",
    ],
    faq: [
      ["Is the format right for school?", "It follows the format taught in Bangladeshi schools: date, “To” and the address, subject, the request, and your name, class and roll at the end."],
      ["Can I write my own reason?", "Yes. Choose “Write my own” and type it. Check the finished letter on the right and change anything you like."],
      ["Is anything I type sent to you?", PRIVATE_DOC],
    ],
    next: { href: "/habits", label: "Start the habit tracker", text: "Back at school? Catch up with a small study habit every day." },
  },
  {
    slug: "testimonial-application",
    name: "Testimonial or TC application",
    title: "Application for a Testimonial or Transfer Certificate (TC), in English and Bangla",
    description: "Write an application to your headmaster or principal for a testimonial after SSC or HSC, or for a transfer certificate (TC) when you change school. English or Bangla, ready to print. Free.",
    heading: "Testimonial or transfer certificate application",
    summary: "After SSC or HSC, or when you change school.",
    bn: "প্রশংসাপত্র বা ছাড়পত্রের (টিসি) জন্য আবেদন",
    group: "templates",
    keywords: ["application for testimonial", "application for transfer certificate", "tc application", "প্রশংসাপত্রের জন্য আবেদন", "ছাড়পত্রের জন্য আবেদন"],
    steps: [
      "Choose a testimonial or a transfer certificate, and English or বাংলা.",
      "Fill in your exam, year and result (or why you’re leaving), and your roll.",
      "Print it, save it as a PDF, or download it for Word.",
    ],
    faq: [
      ["What’s the difference?", "A testimonial (প্রশংসাপত্র) says you studied there and passed, usually needed for college admission. A transfer certificate (ছাড়পত্র) lets you move to another school or college."],
      ["Is anything I type sent to you?", PRIVATE_DOC],
    ],
    next: { href: "/roadmaps", label: "Browse roadmaps", text: "Starting college? Plan a tech career with a free, step-by-step roadmap." },
  },
  {
    slug: "cover-letter",
    name: "Cover letter",
    title: "Cover Letter Template for Job Applications",
    description: "Write a cover letter for a job or internship in minutes: fill in the job, the company and what you can offer, then print it, save a PDF or download it for Word. Free.",
    heading: "Cover letter",
    summary: "For a first job or an internship.",
    bn: "চাকরির আবেদনের কভার লেটার",
    group: "templates",
    keywords: ["cover letter", "cover letter for fresher", "cover letter template", "job application letter", "internship cover letter", "job", "letter"],
    steps: [
      "Fill in the job, the company and where you saw it.",
      "Say who you are in one line, and list what you can offer, one point per line.",
      "Print it, save a PDF, or download it to finish in Word.",
    ],
    faq: [
      ["How long should it be?", "One page. Three or four short points about what you can offer is enough; your CV has the rest."],
      ["Should I change it for each job?", "Yes. Use the company’s name, say why you want to work there, and pick the points that match the job post."],
      ["Is anything I type sent to you?", PRIVATE_DOC],
    ],
    next: { href: "/cv", label: "Build your CV", text: "Send it with an ATS-friendly CV, made free in the CV Builder." },
  },
  {
    slug: "assignment-cover-page",
    name: "Assignment cover page",
    title: "Assignment Cover Page Maker for University and School",
    description: "Make a neat assignment cover page with your university or school, course, topic, teacher and your ID, plus the logo if you like. English or Bangla, ready to print or save as a PDF. Free.",
    heading: "Assignment cover page",
    summary: "University or school, with your logo, in English or Bangla.",
    bn: "অ্যাসাইনমেন্টের কভার পেজ",
    group: "templates",
    keywords: ["assignment cover page", "assignment front page", "cover page for assignment", "অ্যাসাইনমেন্ট কভার পেজ"],
    steps: [
      "Fill in your institution, the course and the assignment title. Add the logo if you have it.",
      "Add your teacher’s name and your own name and ID.",
      "Print it, save it as a PDF, or download it for Word. Put it in front of your assignment with Merge PDF.",
    ],
    faq: [
      ["How do I put it in front of my assignment?", "Save the cover page as a PDF, then use Merge PDF to put it first, before your assignment pages."],
      ["Where do I get the logo?", "Save it from your university’s website, or take a clear photo of it. It stays on your device."],
      ["Is anything I type sent to you?", PRIVATE_DOC],
    ],
    next: { href: "/tools/merge-pdf", label: "Merge PDFs", text: "Put the cover page in front of your assignment with Merge PDF." },
  },
  {
    slug: "handwriting-to-text",
    name: "Handwriting to text",
    title: "Handwriting to Text: Turn Notes into Text, a Summary and a Quiz",
    description: "Photograph handwritten notes, letters or pages, in Bangla or English, and get them as typed text. Then let AI make a summary or a practice quiz from them. Free with a Google sign-in.",
    heading: "Handwriting to text",
    summary: "Handwriting to typed text, then a summary or a quiz.",
    bn: "হাতে লেখা নোট থেকে টেক্সট, সারাংশ ও কুইজ",
    group: "study",
    onDevice: false,
    keywords: ["handwriting to text", "notes to text", "image to text", "image to text bangla", "ocr", "handwritten notes ocr", "summary", "quiz", "হাতের লেখা থেকে টেক্সট"],
    steps: [
      "Sign in, then add photos of up to 3 pages of notes.",
      "Read them: the text appears in a box where you can fix any word.",
      "Make a revision summary, or take a practice quiz on your own notes.",
    ],
    faq: [
      ["Why do I need to sign in?", "Reading handwriting uses AI, which costs us money for every page. Signing in lets us give everyone a fair daily allowance, shown on the page."],
      ["Are my photos kept?", "No. Your photos are sent securely to our server and to our AI provider, Anthropic, only so the writing can be read. We don’t save them; we only count how many readings you used today."],
      ["Does it read Bangla handwriting?", "Yes, Bangla and English. Neat writing, good light and a photo taken straight on give the best result. Words it can’t read are marked [?] so you can fix them."],
      ["Can I use typed notes?", "Yes. Paste them into the text box and make a summary or a quiz straight away."],
    ],
    next: { href: "/habits", label: "Start the habit tracker", text: "Revise a little every day: track it with the free habit tracker." },
  },
  {
    slug: "compress-image",
    name: "Compress image",
    title: "Compress Image to 50 KB, 100 KB or 200 KB",
    description: "Reduce a photo or scan to 50 KB, 100 KB, 200 KB or any size you need for online forms, keeping it as clear as possible. Free, several at once, and your images never leave your device.",
    heading: "Compress images to a set size",
    summary: "Shrink photos and scans to 50, 100 or 200 KB for uploads.",
    bn: "ছবির সাইজ কমান: ৫০, ১০০ বা ২০০ কেবি",
    group: "images",
    keywords: ["compress image to 100kb", "compress image to 50kb", "reduce photo size", "image size reducer", "kb", "jpg", "shrink", "ছবির সাইজ কমানো"],
    steps: [
      "Add one or more images (JPG, PNG, WebP; HEIC in Safari).",
      "Pick the size limit the form gives you, or type your own.",
      "Download each image, or all of them in one zip.",
    ],
    faq: [
      ["How does it keep the picture clear?", "It first lowers the JPG quality only as far as needed, and makes the picture smaller only if that isn’t enough. You always get the clearest version that fits the limit."],
      ["My image is already under the limit. Will it get worse?", "No. If it’s already a JPG under the limit you get it back unchanged."],
      ["Should I choose JPG or WebP?", "JPG works on every form. WebP is a little smaller but some forms don’t accept it."],
      ["Are my images uploaded?", PRIVATE],
    ],
    next: { href: "/roadmaps", label: "Browse roadmaps", text: "Learning a tech skill? Follow a free, step-by-step roadmap." },
  },
  {
    slug: "convert-image",
    name: "Convert image",
    title: "Convert Images: JPG to PNG, PNG to JPG, WebP to JPG",
    description: "Convert images between JPG, PNG and WebP in your browser: PNG to JPG, JPG to PNG, WebP to JPG and more. Free, several at once, and nothing is uploaded.",
    heading: "Convert JPG, PNG and WebP",
    summary: "PNG to JPG, WebP to JPG, JPG to PNG and more.",
    bn: "JPG, PNG ও WebP ফরম্যাটে ছবি কনভার্ট করুন",
    group: "images",
    keywords: ["png to jpg", "jpg to png", "webp to jpg", "heic to jpg", "image converter"],
    steps: [
      "Add your images.",
      "Choose the format you need. For JPG and WebP you can set the quality.",
      "Download each one, or all of them as a zip.",
    ],
    faq: [
      ["What happens to transparent backgrounds when I convert to JPG?", "JPG can’t be transparent, so see-through areas become white."],
      ["Can I convert iPhone HEIC photos?", "Yes, in Safari on an iPhone, iPad or Mac, which can open HEIC. Other browsers can’t read HEIC yet."],
      ["Are my images uploaded?", PRIVATE],
    ],
    next: { href: "/roadmaps/frontend", label: "See the roadmap", text: "Image formats are part of web development. Start the Frontend Developer roadmap." },
  },
  {
    slug: "image-to-pdf",
    name: "Image to PDF",
    title: "Image to PDF: Combine Photos into One PDF",
    description: "Turn photos or scans of documents, receipts, notes or assignment pages into one PDF, in the order you choose, on A4 or Letter pages. Free, and your photos stay on your device.",
    heading: "Images to one PDF",
    summary: "Turn photos or scans into one PDF.",
    bn: "ছবি থেকে একটি PDF বানান",
    group: "images",
    keywords: ["image to pdf", "jpg to pdf", "photo to pdf", "assignment pdf", "ছবি থেকে পিডিএফ"],
    steps: [
      "Add your photos or scans.",
      "Put them in order with the arrows, and choose the page size.",
      "Download one PDF with a page for each image.",
    ],
    faq: [
      ["Which page size should I use?", "A4 is standard in Bangladesh for assignments and forms. Fit to image makes each page the same shape as its picture."],
      ["My photos are sideways.", "Auto turns each page to match its photo. Photos taken on a phone are shown the right way up."],
      ["Are my photos uploaded?", PRIVATE],
    ],
    next: { href: "/habits", label: "Start the habit tracker", text: "Assignments on time, every week? Build the daily study habit that gets you there." },
  },
  {
    slug: "merge-pdf",
    name: "Merge PDF",
    title: "Merge PDF Files into One",
    description: "Combine several PDFs into one file in the order you want: documents, certificates, invoices or a full report. Free, in your browser, with no upload.",
    heading: "Merge PDFs into one",
    summary: "Combine several PDFs into one file.",
    bn: "একাধিক PDF এক ফাইলে যুক্ত করুন",
    group: "pdf",
    keywords: ["merge pdf", "combine pdf", "join pdf files", "পিডিএফ যুক্ত করা", "পিডিএফ"],
    steps: [
      "Add two or more PDFs.",
      "Put them in order with the arrows.",
      "Download the merged PDF.",
    ],
    faq: [
      ["A file says it’s locked. What can I do?", "Password-protected PDFs can’t be merged. Open it, then save or print it as a new PDF without the password, and add that one."],
      ["Is there a size limit?", "Only your device’s memory. Most phones handle a few hundred pages."],
      ["Are my files uploaded?", PRIVATE],
    ],
    next: { href: "/habits", label: "Start the habit tracker", text: "Keep your coursework moving with a few small habits every day." },
  },
  {
    slug: "split-pdf",
    name: "Split PDF",
    title: "Split PDF: Extract Pages or Split into Separate Files",
    description: "Take the pages you need out of a PDF, or split it into separate files by page or by range. Free and private: the PDF never leaves your device.",
    heading: "Split a PDF",
    summary: "Take out the pages you need, or split into files.",
    bn: "PDF থেকে পৃষ্ঠা আলাদা করুন",
    group: "pdf",
    keywords: ["split pdf", "extract pdf pages", "separate pdf pages", "পিডিএফ ভাগ করা"],
    steps: [
      "Add a PDF.",
      "Type the pages you want, like 1-3, 5, or choose to split every page.",
      "Download the new PDF, or a zip of the separate files.",
    ],
    faq: [
      ["How do I write the pages?", "Use commas between pages and a dash for a run: 1-3, 5, 8-10. “8-” means page 8 to the end. Bengali digits work too."],
      ["Can I change the page order?", "Yes. Pages come out in the order you type them, so 3, 1, 2 puts page 3 first."],
      ["Are my files uploaded?", PRIVATE],
    ],
    next: { href: "/ai", label: "Ask the AI Tutor", text: "Not sure what to study next? Ask the AI Tutor for a plan." },
  },
  {
    slug: "compress-pdf",
    name: "Compress PDF",
    title: "Compress PDF: Reduce PDF Size for Uploads",
    description: "Make a scanned PDF, certificate or document small enough to upload to a job or admission form. Choose how strong, see the new size, and download. Free, with no upload.",
    heading: "Compress a PDF",
    summary: "Shrink scanned documents and certificates for upload.",
    bn: "PDF ফাইলের সাইজ কমান",
    group: "pdf",
    keywords: ["compress pdf", "reduce pdf size", "pdf size reducer", "compress pdf to 1mb", "shrink", "kb", "mb", "পিডিএফ সাইজ কমানো"],
    steps: [
      "Add a PDF.",
      "Choose Strong, Balanced or Light.",
      "Check the new size, then download. Try another strength if it’s not small enough.",
    ],
    faq: [
      ["How does it work?", "Each page is redrawn as a clear image at a lower resolution. That shrinks scans and photos a lot, which are what usually make a PDF too big."],
      ["Can I still select the text afterwards?", "No. Text becomes part of the page image, so you can’t select or search it. That’s fine for scanned certificates, marksheets and forms, but keep your original if you need the text."],
      ["The file got bigger.", "PDFs made of plain text are already small. If compressing doesn’t help we tell you, and you can keep the original."],
      ["Are my files uploaded?", PRIVATE],
    ],
    next: { href: "/cv", label: "Build your CV", text: "Uploading certificates for a job? Make your CV next, free." },
  },
  {
    slug: "pdf-to-image",
    name: "PDF to image",
    title: "PDF to JPG or PNG: Convert PDF Pages to Images",
    description: "Turn every page of a PDF, or just the ones you choose, into JPG or PNG images. Free, high quality, and the PDF never leaves your device.",
    heading: "PDF pages to images",
    summary: "Save PDF pages as JPG or PNG pictures.",
    bn: "PDF পৃষ্ঠাকে ছবিতে রূপান্তর করুন",
    group: "pdf",
    keywords: ["pdf to jpg", "pdf to png", "pdf to image", "পিডিএফ থেকে ছবি"],
    steps: [
      "Add a PDF.",
      "Choose JPG or PNG, the quality, and which pages.",
      "Download each page, or all of them as a zip.",
    ],
    faq: [
      ["JPG or PNG?", "JPG gives smaller files and suits most uploads. PNG keeps text perfectly sharp but files are bigger."],
      ["What does High quality mean?", "Standard draws pages at 150 dpi, good for screens and uploads. High uses 220 dpi, for printing or reading small text."],
      ["Are my files uploaded?", PRIVATE],
    ],
    next: { href: "/roadmaps", label: "Browse roadmaps", text: "Turning notes into progress? Pick a roadmap and tick off topics as you learn." },
  },
  {
    slug: "pdf-page-numbers",
    name: "Add page numbers",
    title: "Add Page Numbers to a PDF",
    description: "Number the pages of a report, thesis, contract or assignment PDF. Choose where the numbers go, the style, the first number, and skip the cover page. Free and private.",
    heading: "Add page numbers to a PDF",
    summary: "Number any PDF, with or without a cover page.",
    bn: "PDF-এ পৃষ্ঠা নম্বর যোগ করুন",
    group: "pdf",
    keywords: ["add page numbers to pdf", "number pdf pages", "pdf page numbering", "পৃষ্ঠা নম্বর"],
    steps: [
      "Add your PDF.",
      "Choose where the numbers go and how they look, for example “Page 1 of 12”. Skip the cover if you like.",
      "Download the numbered PDF.",
    ],
    faq: [
      ["Can I leave the cover page without a number?", "Yes. Turn on Skip the cover page and numbering starts on page 2, as 1 (or whatever first number you choose)."],
      ["Can I start from a number other than 1?", "Yes. Set the first number, for example to continue from a previous part."],
      ["Are my files uploaded?", PRIVATE],
    ],
    next: { href: "/habits", label: "Start the habit tracker", text: "Report done? Keep the momentum with a daily habit tracker." },
  },
  {
    slug: "bijoy-unicode-converter",
    name: "Bijoy ↔ Unicode",
    title: "Bijoy to Unicode and Unicode to Bijoy Converter (SutonnyMJ)",
    description: "Convert Bangla text typed in Bijoy (SutonnyMJ) to Unicode for Facebook, Google Docs and the web, or Unicode back to Bijoy for printing. Free, instant, and works offline in your browser.",
    heading: "Bijoy ↔ Unicode converter",
    summary: "SutonnyMJ text to Unicode Bangla, and back.",
    bn: "বিজয় থেকে ইউনিকোড, ইউনিকোড থেকে বিজয়",
    group: "bangla",
    keywords: ["bijoy to unicode", "unicode to bijoy", "sutonnymj to unicode", "বিজয় থেকে ইউনিকোড", "ইউনিকোড থেকে বিজয়"],
    steps: [
      "Paste your text. The direction is picked for you, or choose it yourself.",
      "The converted text appears straight away.",
      "Copy it, or download it as a text file.",
    ],
    faq: [
      ["Why does my Bijoy text look like English letters?", "Bijoy text is stored as English letters and symbols that the SutonnyMJ font draws as Bengali. Without that font it looks like “Avgvi †mvbvi evsjv”. Unicode is real Bengali text that works everywhere."],
      ["When do I need Unicode to Bijoy?", "When a press, a government office or an older computer only works with SutonnyMJ. Paste the result into a document set in SutonnyMJ."],
      ["Is my text sent anywhere?", "No. The conversion happens in your browser, so your text never leaves your device."],
    ],
    next: { href: "/ai", label: "Ask the AI Tutor", text: "Planning a tech career? The AI Tutor suggests where to start." },
  },
];

export function getTool(slug: string): Tool {
  const t = TOOLS.find((x) => x.slug === slug);
  if (!t) throw new Error(`Unknown tool: ${slug}`);
  return t;
}

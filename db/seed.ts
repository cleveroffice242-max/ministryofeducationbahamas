import { sql } from "drizzle-orm";
import { db } from "./index.js";
import { stories, storyLinks, ministryRecords } from "./schema.js";

const img = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1600&q=80`;
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000);

// Starter coverage matching the Dashboard's monitored mentions. Staff can replace
// the source URLs with the exact article/post links as coverage is logged.
const seedStories = [
  {
    slug: "breakfast-program-expansion",
    title: "National Primary School Breakfast Program Expands to 8 More Family Island Schools",
    outlet: "ZNS Bahamas",
    handle: "@ZNSBahamas",
    channel: "News",
    sourceUrl: "https://znsbahamas.com/",
    publishedAt: hoursAgo(0.2),
    summary:
      "The Minister of Education announced the full rollout of the National Primary School Breakfast Program to eight additional Family Island primary schools, now serving more than 14,350 hot meals every school day.",
    body:
      "The Ministry of Education, Science and Technology (MOEST) confirmed the expansion of its National Primary School Breakfast Program, extending daily hot meals to eight additional primary schools across the Family Islands.\n\nSpeaking at the launch, the Minister noted that the program now serves over 14,350 students each school day, and that early attendance and classroom-readiness indicators in participating schools have improved since the first phase.\n\nDistrict superintendents are coordinating with local vendors to source produce on-island wherever possible, supporting Family Island economies while keeping costs sustainable. The Ministry will publish a full implementation report at the end of the term.",
    imageUrl: img("photo-1490645935967-10de6ba17061"),
    imageCaption: "Fresh breakfast service for primary students (illustrative photo).",
    videoUrl: null,
    sentiment: "POSITIVE",
    tags: "#SchoolBreakfast #MOESTBahamas #FamilyIslands",
  },
  {
    slug: "gov-high-ac-repairs",
    title: "Parents Raise Concerns Over Cooling System Repairs at Government High School",
    outlet: "Bahamas Press",
    handle: "@BahamasPress",
    channel: "Facebook",
    sourceUrl: "https://bahamaspress.com/",
    publishedAt: hoursAgo(0.6),
    summary:
      "Parents voiced frustration on social media about classroom heat at Government High School while cooling units await repair. MOEST maintenance teams have been dispatched to replace compressor units.",
    body:
      "A widely shared post from Bahamas Press highlighted complaints from parents about afternoon classroom temperatures at Government High School in New Providence.\n\nAccording to the post, several air-conditioning units have been out of service, prompting concern about student comfort and concentration during afternoon sessions.\n\nThe Ministry's Maintenance Unit has dispatched technicians to replace failed compressor units, and the school administration has adjusted room assignments in the interim. The Communications Section has flagged this story as a priority for an official service advisory.",
    imageUrl: img("photo-1580582932707-520aed937b7b"),
    imageCaption: "Secondary school classroom block (illustrative photo).",
    videoUrl: null,
    sentiment: "NEGATIVE",
    tags: "#SchoolACRepairs #NewProvidence",
  },
  {
    slug: "bgcse-bjc-stem-registration",
    title: "BGCSE & BJC Registration Hits Record High in STEM Subjects",
    outlet: "The Tribune 242",
    handle: "@Tribune242",
    channel: "News",
    sourceUrl: "https://www.tribune242.com/",
    publishedAt: hoursAgo(1),
    summary:
      "National examination registration recorded a 5% rise in STEM subject enrollment, and the Ministry of Education's Examination & Assessment Division confirmed all centres are prepared across Grand Bahama and New Providence.",
    body:
      "Registration figures for the 2026 BGCSE and BJC national examinations show a record number of candidates sitting STEM subjects, with enrolment up five percent year on year.\n\nThe Examination and Assessment Division confirmed that all examination centres in Grand Bahama and New Providence have completed readiness inspections, and that Family Island centres are on schedule.\n\nEducators credit expanded STEM lab access and teacher training for the increase. The Ministry of Education is encouraging candidates to review the official examination timetable published on its website.",
    imageUrl: img("photo-1532094349884-543bc11b234d"),
    imageCaption: "Students in a science laboratory (illustrative photo).",
    videoUrl: null,
    sentiment: "POSITIVE",
    tags: "#BGCSE2026 #BahamasEducation #STEMBahamas",
  },
  {
    slug: "but-consultative-meeting",
    title: "BUT Holds Consultative Meeting with MOEST on Teacher Stipends & Housing",
    outlet: "Bahamas Union of Teachers (BUT)",
    handle: "@BUT_Official",
    channel: "X",
    sourceUrl: "https://x.com/search?q=Bahamas%20Union%20of%20Teachers",
    publishedAt: hoursAgo(2),
    summary:
      "The Bahamas Union of Teachers described a constructive meeting with the MOEST executive team on specialised teacher stipends and Family Island housing allowances for the 2026/2027 academic year.",
    body:
      "In a post on X, the Bahamas Union of Teachers reported a constructive consultative meeting with the MOEST executive team.\n\nDiscussion focused on specialised teacher stipends and Family Island housing allowances ahead of the 2026/2027 academic year. Both parties agreed to continue talks at the next quarterly session.\n\nThe Ministry's Human Resources and Communications sections are preparing a joint summary of agreed next steps.",
    imageUrl: img("photo-1524178232363-1fb2b075b655"),
    imageCaption: "Teachers in a professional meeting (illustrative photo).",
    videoUrl: null,
    sentiment: "NEUTRAL",
    tags: "#BUT_Union #TeacherSupport",
  },
  {
    slug: "bhsd-graduation-rate",
    title: "BHSD Graduation Rate Climbs to 59.4% on Path to 2030 Target",
    outlet: "Nassau Guardian",
    handle: "@NassauGuardian",
    channel: "News",
    sourceUrl: "https://thenassauguardian.com/",
    publishedAt: hoursAgo(3),
    summary:
      "The Bahamas High School Diploma national graduation rate has risen to 59.4%, marking steady progress toward the national target of 85% by 2030.",
    body:
      "New figures show the national graduation rate for the Bahamas High School Diploma (BHSD) has reached 59.4 percent.\n\nThe Ministry has set a national target of 85 percent by 2030, supported by literacy intervention, technical and vocational pathways, and expanded guidance counselling.\n\nOfficials cautioned that progress varies by district, and that targeted support will continue in schools with the largest gaps.",
    imageUrl: img("photo-1627556704302-624286467c65"),
    imageCaption: "Graduating students (illustrative photo).",
    videoUrl: null,
    sentiment: "POSITIVE",
    tags: "#BHSD #BahamasEducation #MOEST",
  },
  {
    slug: "digital-literacy-curriculum",
    title: "MOEST Releases Digital Literacy & Coding Guidelines for Primary Schools",
    outlet: "ZNS News Nightly",
    handle: "@ZNSNightly",
    channel: "News",
    sourceUrl: "https://znsbahamas.com/",
    publishedAt: hoursAgo(6),
    summary:
      "Updated curriculum guidelines introduce digital literacy and introductory coding into primary schools, beginning with pilot schools in Abaco and Eleuthera.",
    body:
      "The Ministry has released updated curriculum guidelines that integrate digital literacy, computational thinking and introductory coding into the primary school timetable.\n\nThe rollout begins with pilot schools in Abaco and Eleuthera, supported by teacher training and new classroom devices. The embedded video is a supplementary STEM explainer shared by the curriculum unit.",
    imageUrl: img("photo-1509062522246-3755977927d7"),
    imageCaption: "Students learning with laptops (illustrative photo).",
    videoUrl: "https://www.youtube.com/watch?v=aircAruvnKk",
    sentiment: "POSITIVE",
    tags: "#STEMBahamas #MOEST",
  },
];

const seedRecords = [
  {
    kind: "Response",
    title: "Service Advisory: Government High School Cooling Repairs",
    body:
      "MINISTRY OF EDUCATION SERVICE ADVISORY\n\nRegarding concerns raised about classroom temperatures at Government High School, MOEST technical teams are actively replacing failed compressor units. Maintenance staff and the district superintendent are on-site, and interim room reassignments are in place to ensure suitable conditions for students and staff.\n\nFurther updates will be shared through the Ministry's official channels.",
    status: "In Review",
    author: "Communications Section",
    department: "Communications",
    storySlug: "gov-high-ac-repairs",
  },
  {
    kind: "Press Release",
    title: "Breakfast Program Expansion — Public Notice",
    body:
      "PRESS RELEASE\n\nThe Ministry of Education, Science and Technology is pleased to announce the expansion of the National Primary School Breakfast Program to eight additional Family Island primary schools. The program now serves more than 14,350 students each school day.\n\nWe thank our teachers, administrators, vendors and community partners for their support.",
    status: "Approved",
    author: "Press Office",
    department: "Communications",
    storySlug: "breakfast-program-expansion",
  },
  {
    kind: "Data Brief",
    title: "BHSD Graduation Rate — Key Figures",
    body:
      "National BHSD graduation rate: 59.4%\nNational target: 85% by 2030\nSTEM examination enrolment change: +5% year on year\nBreakfast program daily meals: 14,350+\n\nSource: MOEST Planning & Research Unit (internal working figures).",
    status: "Draft",
    author: "Planning & Research",
    department: "Planning & Research",
    storySlug: "bhsd-graduation-rate",
  },
  {
    kind: "Write-up",
    title: "Weekly Media Summary — Week 40",
    body:
      "Coverage this week was predominantly positive (68%), led by the Breakfast Program expansion and record STEM examination registration.\n\nThe main reputational risk remains the Government High School cooling repairs, which generated high share volume on Facebook. A service advisory is in review.\n\nRecommended actions: publish the advisory, share BHSD progress figures, and prepare a joint BUT/MOEST statement following the consultative meeting.",
    status: "Draft",
    author: "Communications Section",
    department: "Communications",
    storySlug: null,
  },
];

export async function ensureSeeded() {
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(stories);
  if (count > 0) return;

  const inserted = await db.insert(stories).values(seedStories).onConflictDoNothing().returning();
  const bySlug = new Map(inserted.map((s) => [s.slug, s.id]));

  const stem = bySlug.get("bgcse-bjc-stem-registration");
  if (stem) {
    await db.insert(storyLinks).values({
      storyId: stem,
      title: "BJC & BGCSE examination information",
      url: "https://www.bahamas.gov.bs/",
      note: "Government of The Bahamas portal",
      addedBy: "Communications Section",
    });
  }

  if (inserted.length) {
    await db.insert(ministryRecords).values(
      seedRecords.map(({ storySlug, ...r }) => ({ ...r, storyId: storySlug ? bySlug.get(storySlug) ?? null : null })),
    );
  }
}

export type Role =
  | "Lead Photographer"
  | "Second Shooter"
  | "Videographer"
  | "Drone Operator"
  | "Content Creator";
export type Region =
  "North East" | "West Coast" | "Midwest" | "South" | "All Regions";
export type ApplicationStatus =
  "Apply" | "Applied" | "Re-Apply" | "Awarded" | "Declined" | "Under Review";

export interface Contractor {
  id: string;
  userId: string;
  crmContactId: string;
  fullName: string;
  email: string;
  phone: string;
  region: Region[];
  roles: Role[];
  tags: string[];
  portfolioUrl: string;
  rating: number;
  completedJobs: number;
  status: "invited" | "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

export interface Wedding {
  id: string;
  crmContactId: string;
  title: string;
  brideName: string;
  partnerName: string;
  weddingDate: string;
  venue: string;
  city: string;
  state: string;
  region: Region;
  packageName: string;
  notes: string;
  contactEmail: string;
  contactPhone: string;
  status: "imported" | "reviewed" | "active" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface Position {
  id: string;
  weddingId: string;
  title: string;
  category: Role;
  requiredTags: string[];
  quantityNeeded: number;
  filledCount: number;
  rate: string;
  description: string;
  eventDate: string;
  city: string;
  state: string;
  region: Region;
  visibility: "draft" | "open" | "filled" | "closed";
  createdByManagerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Application {
  id: string;
  positionId: string;
  contractorId: string;
  status: "applied" | "under_review" | "awarded" | "declined" | "canceled";
  createdAt: string;
  updatedAt: string;
}

export interface Assignment {
  id: string;
  weddingId: string;
  positionId: string;
  contractorId: string;
  role: Role;
  eventDate: string;
  location: string;
  pay: string;
  notes: string;
  status: "upcoming" | "completed" | "canceled";
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  date: string;
  read: boolean;
  type: "position" | "application" | "assignment" | "system";
  link?: string;
}

// MOCK DATA

export const mockContractors: Contractor[] = [
  {
    id: "cont-1",
    userId: "user-1",
    crmContactId: "crm-1",
    fullName: "Alex Morgan",
    email: "alex@example.com",
    phone: "555-0101",
    region: ["West Coast"],
    roles: ["Lead Photographer", "Second Shooter"],
    tags: ["photographer", "lead_photographer", "second_shooter"],
    portfolioUrl: "https://alexmorganphoto.com",
    rating: 4.9,
    completedJobs: 34,
    status: "active",
    createdAt: "2025-01-10T10:00:00Z",
    updatedAt: "2025-01-10T10:00:00Z",
  },
  {
    id: "cont-2",
    userId: "user-2",
    crmContactId: "crm-2",
    fullName: "Jordan Lee",
    email: "jordan@example.com",
    phone: "555-0102",
    region: ["West Coast"],
    roles: ["Videographer"],
    tags: ["videographer"],
    portfolioUrl: "https://jordanleevideo.com",
    rating: 4.7,
    completedJobs: 12,
    status: "active",
    createdAt: "2025-02-15T10:00:00Z",
    updatedAt: "2025-02-15T10:00:00Z",
  },
];

export const mockWeddings: Wedding[] = [
  {
    id: "wed-1",
    crmContactId: "crm-wed-1",
    title: "Smith & Johnson Wedding",
    brideName: "Emily Smith",
    partnerName: "Michael Johnson",
    weddingDate: "2026-06-15",
    venue: "Malibu Vineyard",
    city: "Malibu",
    state: "CA",
    region: "West Coast",
    packageName: "Diamond Package",
    notes: "VIP clients, expecting high quality coverage.",
    contactEmail: "emily@example.com",
    contactPhone: "555-0201",
    status: "active",
    createdAt: "2026-01-01T10:00:00Z",
    updatedAt: "2026-01-01T10:00:00Z",
  },
  {
    id: "wed-2",
    crmContactId: "crm-wed-2",
    title: "Davis Elopement",
    brideName: "Sarah Davis",
    partnerName: "Tom Wilson",
    weddingDate: "2026-07-02",
    venue: "Columbia River Gorge",
    city: "Portland",
    state: "OR",
    region: "West Coast",
    packageName: "Elopement Special",
    notes: "Intimate ceremony, focus on nature shots.",
    contactEmail: "sarah@example.com",
    contactPhone: "555-0202",
    status: "active",
    createdAt: "2026-01-15T10:00:00Z",
    updatedAt: "2026-01-15T10:00:00Z",
  },
  {
    id: "wed-3",
    crmContactId: "crm-wed-3",
    title: "Chen & Williams Gala",
    brideName: "Jessica Chen",
    partnerName: "David Williams",
    weddingDate: "2026-08-20",
    venue: "The Plaza",
    city: "New York",
    state: "NY",
    region: "North East",
    packageName: "Platinum Package",
    notes: "Large wedding, 300+ guests.",
    contactEmail: "jessica@example.com",
    contactPhone: "555-0203",
    status: "imported",
    createdAt: "2026-02-01T10:00:00Z",
    updatedAt: "2026-02-01T10:00:00Z",
  },
];

export const mockPositions: Position[] = [
  {
    id: "pos-1",
    weddingId: "wed-1",
    title: "Lead Photographer",
    category: "Lead Photographer",
    requiredTags: ["photographer", "lead_photographer"],
    quantityNeeded: 1,
    filledCount: 0,
    rate: "$1,200",
    description:
      "Looking for an experienced lead photographer for an elegant outdoor wedding at a vineyard. 8 hours of coverage required. Must have experience with natural light and off-camera flash for the reception.",
    eventDate: "2026-06-15",
    city: "Malibu",
    state: "CA",
    region: "West Coast",
    visibility: "open",
    createdByManagerId: "manager-1",
    createdAt: "2026-02-10T10:00:00Z",
    updatedAt: "2026-02-10T10:00:00Z",
  },
  {
    id: "pos-2",
    weddingId: "wed-1",
    title: "Second Shooter",
    category: "Second Shooter",
    requiredTags: ["photographer", "second_shooter"],
    quantityNeeded: 1,
    filledCount: 0,
    rate: "$600",
    description:
      "Need a strong second shooter to focus on groom prep, candid guest reactions, and alternate angles during ceremony.",
    eventDate: "2026-06-15",
    city: "Malibu",
    state: "CA",
    region: "West Coast",
    visibility: "open",
    createdByManagerId: "manager-1",
    createdAt: "2026-02-10T10:00:00Z",
    updatedAt: "2026-02-10T10:00:00Z",
  },
  {
    id: "pos-3",
    weddingId: "wed-2",
    title: "Lead Videographer",
    category: "Videographer",
    requiredTags: ["videographer"],
    quantityNeeded: 1,
    filledCount: 1,
    rate: "$900",
    description:
      "Intimate elopement in the Columbia River Gorge. 4 hours of coverage. Focus on storytelling and scenic shots.",
    eventDate: "2026-07-02",
    city: "Portland",
    state: "OR",
    region: "West Coast",
    visibility: "filled",
    createdByManagerId: "manager-1",
    createdAt: "2026-02-15T10:00:00Z",
    updatedAt: "2026-02-15T10:00:00Z",
  },
];

export const mockApplications: Application[] = [
  {
    id: "app-1",
    positionId: "pos-1",
    contractorId: "cont-1",
    status: "applied",
    createdAt: "2026-03-01T10:00:00Z",
    updatedAt: "2026-03-01T10:00:00Z",
  },
  {
    id: "app-2",
    positionId: "pos-3",
    contractorId: "cont-2",
    status: "awarded",
    createdAt: "2026-03-05T10:00:00Z",
    updatedAt: "2026-03-06T10:00:00Z",
  },
];

export const mockAssignments: Assignment[] = [
  {
    id: "assg-1",
    weddingId: "wed-2",
    positionId: "pos-3",
    contractorId: "cont-2",
    role: "Videographer",
    eventDate: "2026-07-02",
    location: "Portland, OR",
    pay: "$900",
    notes: "Client requested cinematic style.",
    status: "upcoming",
    createdAt: "2026-03-06T10:00:00Z",
    updatedAt: "2026-03-06T10:00:00Z",
  },
];

export const mockNotifications: Notification[] = [
  {
    id: "notif-1",
    userId: "user-2",
    title: "Application Status Update",
    message: "You have been awarded the Davis Elopement assignment!",
    date: "2 hours ago",
    read: false,
    type: "assignment",
  },
  {
    id: "notif-2",
    userId: "user-1",
    title: "New Position in Your Region",
    message:
      "A new Lead Photographer position is open for Smith & Johnson Wedding in Malibu, CA.",
    date: "1 day ago",
    read: false,
    type: "position",
  },
];

// Compatibility exports for existing code (to be refactored)
export const mockUser = {
  name: "Alex Morgan",
  email: "alex@example.com",
  region: ["West Coast"],
  roles: ["Lead Photographer", "Second Shooter"],
  avatar: "https://i.pravatar.cc/150?u=a042581f4e29026704d",
  rating: 4.9,
  completedJobs: 34,
};

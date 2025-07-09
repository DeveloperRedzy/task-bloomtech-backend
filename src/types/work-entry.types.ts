export interface WorkEntry {
  id: string;
  userId: string;
  date: Date;
  hours: number;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWorkEntryRequest {
  date: string; // ISO date string
  hours: number;
  description: string;
}

export interface UpdateWorkEntryRequest {
  date?: string; // ISO date string
  hours?: number;
  description?: string;
}

export interface WorkEntryResponse {
  id: string;
  date: string; // ISO date string
  hours: number;
  description: string;
  createdAt: string; // ISO datetime string
  updatedAt: string; // ISO datetime string
}

export interface WorkEntriesListResponse {
  data: WorkEntryResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface WorkEntryFilters {
  startDate?: string; // ISO date string
  endDate?: string; // ISO date string
  sortBy?: 'date' | 'hours' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

// Using AuthenticatedRequest from auth.types.ts for work entry requests

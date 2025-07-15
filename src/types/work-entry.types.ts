export interface WorkEntry {
  id: string;
  userId: string;
  startTime: Date;
  endTime: Date;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWorkEntryRequest {
  startTime: string; // ISO datetime string
  endTime: string; // ISO datetime string
  description: string;
}

export interface UpdateWorkEntryRequest {
  startTime?: string; // ISO datetime string
  endTime?: string; // ISO datetime string
  description?: string;
}

export interface WorkEntryResponse {
  id: string;
  startTime: string; // ISO datetime string
  endTime: string; // ISO datetime string
  duration: number; // Calculated duration in hours
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
  startDate?: string; // ISO date string - filter entries that start on or after this date
  endDate?: string; // ISO date string - filter entries that end on or before this date
  sortBy?: 'startTime' | 'endTime' | 'duration' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

// Using AuthenticatedRequest from auth.types.ts for work entry requests

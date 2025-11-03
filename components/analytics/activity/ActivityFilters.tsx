'use client'

import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'

export interface ActivityFilters {
  search: string
  type: string
  range: string
  user: string
}

interface ActivityFiltersProps {
  filters: ActivityFilters
  onChange: (filters: ActivityFilters) => void
  availableUsers: string[]
}

export function ActivityFilters({ filters, onChange, availableUsers }: ActivityFiltersProps) {
  const handleChange = (key: keyof ActivityFilters, value: string) => {
    onChange({
      ...filters,
      [key]: value,
    })
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {/* Search */}
      <div className="space-y-2">
        <Label htmlFor="activity-search" className="text-sm font-medium">
          Search Events
        </Label>
        <Input
          id="activity-search"
          placeholder="Search events..."
          value={filters.search}
          onChange={(e) => handleChange('search', e.target.value)}
          className="w-full"
        />
      </div>

      {/* Event Type */}
      <div className="space-y-2">
        <Label htmlFor="activity-type" className="text-sm font-medium">
          Event Type
        </Label>
        <Select value={filters.type} onValueChange={(value) => handleChange('type', value)}>
          <SelectTrigger id="activity-type">
            <SelectValue placeholder="All events" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All events</SelectItem>
            <SelectItem value="container_created">Created</SelectItem>
            <SelectItem value="container_edited">Edited</SelectItem>
            <SelectItem value="container_closed">Closed</SelectItem>
            <SelectItem value="container_deleted">Deleted</SelectItem>
            <SelectItem value="container_reopened">Reopened</SelectItem>
            <SelectItem value="csv_imported">Imported</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Time Range */}
      <div className="space-y-2">
        <Label htmlFor="activity-range" className="text-sm font-medium">
          Time Range
        </Label>
        <Select value={filters.range} onValueChange={(value) => handleChange('range', value)}>
          <SelectTrigger id="activity-range">
            <SelectValue placeholder="All time" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All time</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">This week</SelectItem>
            <SelectItem value="month">This month</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* User */}
      <div className="space-y-2">
        <Label htmlFor="activity-user" className="text-sm font-medium">
          User
        </Label>
        <Select value={filters.user} onValueChange={(value) => handleChange('user', value)}>
          <SelectTrigger id="activity-user">
            <SelectValue placeholder="All users" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All users</SelectItem>
            {availableUsers.map((user) => (
              <SelectItem key={user} value={user}>
                {user}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}


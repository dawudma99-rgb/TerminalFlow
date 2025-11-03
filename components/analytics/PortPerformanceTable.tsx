'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/ui/EmptyState'
import type { PortPerformanceData } from '@/lib/analytics'
import { Ship } from 'lucide-react'

interface PortPerformanceTableProps {
  data: PortPerformanceData[]
}

export function PortPerformanceTable({ data }: PortPerformanceTableProps) {
  if (data.length === 0) {
    return (
      <Card className="hover:shadow-md transition-shadow duration-300">
        <CardHeader>
          <CardTitle>Port Performance Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="No port data available"
            description="No containers found with port information."
            icon={<Ship className="h-12 w-12 text-muted-foreground" />}
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="hover:shadow-md transition-shadow duration-300 animate-in fade-in duration-300">
      <CardHeader>
        <CardTitle>Port Performance Analysis</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead aria-label="Port name">Port</TableHead>
                <TableHead className="text-right" aria-label="Number of containers">
                  Containers
                </TableHead>
                <TableHead className="text-right" aria-label="Average days left">
                  Avg Days Left
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((port, index) => (
                <TableRow key={`${port.port}-${index}`} className="hover:bg-muted/50">
                  <TableCell className="font-medium">{port.port}</TableCell>
                  <TableCell className="text-right">{port.count}</TableCell>
                  <TableCell className="text-right">
                    {port.avgDaysLeft !== null && !isNaN(port.avgDaysLeft)
                      ? Math.round(port.avgDaysLeft)
                      : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

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
import type { ListAnalyticsData } from '@/lib/analytics'
import { Folder } from 'lucide-react'

interface ListAnalyticsTableProps {
  data: ListAnalyticsData[]
}

export function ListAnalyticsTable({ data }: ListAnalyticsTableProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(amount)
  }

  if (data.length === 0) {
    return (
      <Card className="hover:shadow-md transition-shadow duration-300">
        <CardHeader>
          <CardTitle>Client & List Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="No list data available"
            description="No lists found with active containers."
            icon={<Folder className="h-12 w-12 text-muted-foreground" />}
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="hover:shadow-md transition-shadow duration-300 animate-in fade-in duration-300">
      <CardHeader>
        <CardTitle>Client & List Analytics</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead aria-label="List name">List Name</TableHead>
                <TableHead className="text-right" aria-label="Active containers">
                  Active Containers
                </TableHead>
                <TableHead className="text-right" aria-label="Overdue containers">
                  Overdue
                </TableHead>
                <TableHead className="text-right" aria-label="Due soon containers">
                  Due Soon
                </TableHead>
                <TableHead className="text-right" aria-label="Estimated fees">
                  Estimated Fees
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((list) => (
                <TableRow key={list.list_id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">{list.list_name}</TableCell>
                  <TableCell className="text-right">{list.activeCount}</TableCell>
                  <TableCell className="text-right">
                    {list.overdueCount > 0 ? (
                      <span className="text-destructive font-medium">{list.overdueCount}</span>
                    ) : (
                      list.overdueCount
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {list.dueSoonCount > 0 ? (
                      <span className="text-warning font-medium">{list.dueSoonCount}</span>
                    ) : (
                      list.dueSoonCount
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(list.estimatedFees)}
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






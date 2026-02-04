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
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/EmptyState'
import Link from 'next/link'
import type { AtRiskContainer } from '@/lib/analytics'
import { AlertTriangle } from 'lucide-react'

interface EnhancedRiskTableProps {
  data: AtRiskContainer[]
  limit?: number
}

export function EnhancedRiskTable({ data, limit = 20 }: EnhancedRiskTableProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(amount)
  }

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'Overdue':
        return <Badge variant="destructive">Overdue</Badge>
      case 'Warning':
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Warning</Badge>
      case 'Safe':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Safe</Badge>
      default:
        return <Badge variant="outline">{status || 'Unknown'}</Badge>
    }
  }

  const displayData = data.slice(0, limit)
  const hasMore = data.length > limit

  if (data.length === 0) {
    return (
      <Card className="hover:shadow-md transition-shadow duration-300">
        <CardHeader>
          <CardTitle>Top Containers at Risk</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="No containers at risk"
            description="All containers are currently safe or there are no containers in the system."
            icon={<AlertTriangle className="h-12 w-12 text-muted-foreground" />}
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="hover:shadow-md transition-shadow duration-300 animate-in fade-in duration-300">
      <CardHeader>
        <CardTitle>Top Containers at Risk</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead aria-label="Container number">Container</TableHead>
                <TableHead aria-label="Port name">Port</TableHead>
                <TableHead aria-label="List name">List</TableHead>
                <TableHead className="text-right" aria-label="Days remaining">
                  Days Left
                </TableHead>
                <TableHead aria-label="Container status">Status</TableHead>
                <TableHead className="text-right" aria-label="Potential fee amount">
                  Potential Fees
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayData.map((container, index) => {
                const totalFees = (container.demurrage_fees || 0) + (container.detention_fees || 0)
                const potentialFee = totalFees > 0 
                  ? totalFees 
                  : (container.demurrage_fee_if_late || 0)
                
                return (
                  <TableRow key={`${container.container_no}-${index}`} className="hover:bg-muted/50">
                    <TableCell className="font-mono text-sm">
                      <Link
                        href="/dashboard/containers"
                        className="text-primary hover:underline"
                      >
                        {container.container_no}
                      </Link>
                    </TableCell>
                    <TableCell>{container.port}</TableCell>
                    <TableCell>{container.list_name || '—'}</TableCell>
                    <TableCell className="text-right">
                      {container.days_left !== null && !isNaN(container.days_left)
                        ? container.days_left
                        : '—'}
                    </TableCell>
                    <TableCell>{getStatusBadge(container.status)}</TableCell>
                    <TableCell className="text-right">
                      {potentialFee > 0 ? formatCurrency(potentialFee) : '—'}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
        {hasMore && (
          <div className="mt-4 text-sm text-muted-foreground text-center">
            Showing top {limit} of {data.length} containers at risk
          </div>
        )}
      </CardContent>
    </Card>
  )
}






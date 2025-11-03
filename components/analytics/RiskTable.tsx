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
import type { AtRiskContainer } from '@/lib/analytics'
import { AlertTriangle } from 'lucide-react'

interface RiskTableProps {
  data: AtRiskContainer[]
}

export function RiskTable({ data }: RiskTableProps) {
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
                <TableHead aria-label="Container number">Container No</TableHead>
                <TableHead aria-label="Port name">Port</TableHead>
                <TableHead className="text-right" aria-label="Days remaining">
                  Days Left
                </TableHead>
                <TableHead aria-label="Container status">Status</TableHead>
                <TableHead className="text-right" aria-label="Potential fee amount">
                  Potential Fee
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((container, index) => (
                <TableRow key={`${container.container_no}-${index}`} className="hover:bg-muted/50">
                  <TableCell className="font-mono text-sm">{container.container_no}</TableCell>
                  <TableCell>{container.port}</TableCell>
                  <TableCell className="text-right">
                    {container.days_left !== null && !isNaN(container.days_left)
                      ? container.days_left
                      : '—'}
                  </TableCell>
                  <TableCell>{getStatusBadge(container.status)}</TableCell>
                  <TableCell className="text-right">
                    {container.demurrage_fee_if_late
                      ? formatCurrency(container.demurrage_fee_if_late)
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

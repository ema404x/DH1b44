import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import StatusBadge from '@/components/shared/StatusBadge';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export default function RecentProjects({ projects }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Proyectos Activos</CardTitle>
          <Link to="/proyectos" className="text-xs text-primary font-medium flex items-center gap-1 hover:underline">
            Ver todos <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {projects.slice(0, 5).map((project) => (
          <div key={project.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{project.name}</p>
              <p className="text-xs text-muted-foreground truncate">{project.client_name}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-24 hidden sm:block">
                <Progress value={project.progress || 0} className="h-1.5" />
              </div>
              <span className="text-xs text-muted-foreground w-8 text-right">{project.progress || 0}%</span>
              <StatusBadge value={project.status} />
            </div>
          </div>
        ))}
        {projects.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">No hay proyectos activos</p>
        )}
      </CardContent>
    </Card>
  );
}
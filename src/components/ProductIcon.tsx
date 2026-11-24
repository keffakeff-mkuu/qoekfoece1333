import React from 'react';
import {
  Boxes,
  Briefcase,
  Building2,
  Compass,
  FileCheck2,
  Globe,
  GraduationCap,
  HardHat,
  HeartPulse,
  Landmark,
  Lock,
  Plane,
  Recycle,
  Shield,
  ShoppingBag,
  Sprout,
  Sun,
  Target,
  Truck,
  Users,
} from 'lucide-react';
import type { CatalogIconKey } from '../lib/catalogMeta';

const ICON_MAP: Record<CatalogIconKey, React.ComponentType<{ className?: string }>> = {
  shield: Shield,
  briefcase: Briefcase,
  target: Target,
  sprout: Sprout,
  globe: Globe,
  boxes: Boxes,
  'heart-pulse': HeartPulse,
  truck: Truck,
  'hard-hat': HardHat,
  compass: Compass,
  lock: Lock,
  sun: Sun,
  users: Users,
  building: Building2,
  'graduation-cap': GraduationCap,
  recycle: Recycle,
  landmark: Landmark,
  plane: Plane,
  'file-shield': FileCheck2,
  'shopping-bag': ShoppingBag,
};

export const ProductIcon: React.FC<{ name?: CatalogIconKey; className?: string }> = ({
  name = 'shield',
  className = 'h-4 w-4',
}) => {
  const Icon = ICON_MAP[name] || Shield;
  return <Icon className={className} />;
};

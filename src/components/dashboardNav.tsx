import { Home, LayoutDashboard, Building2, Calendar, Users, Wallet, FileText, Settings, Bell, Receipt, Wrench, TrendingUp, Search, Activity, LandPlot, Hotel, BadgeDollarSign } from 'lucide-react';

export const ownerNav = [
  {
    label: 'Dashboard',
    to: '/owner',
    icon: <LayoutDashboard className="w-5 h-5" />,
  },
  {
    label: 'Properties',
    to: '/owner/properties',
    icon: <Building2 className="w-5 h-5" />,
  },
  {
    label: 'Portfolio & Assets',
    to: '/owner/portfolio',
    icon: <LandPlot className="w-5 h-5" />,
  },
  {
    label: 'Short-Stay Operations',
    to: '/owner/short-stay',
    icon: <Hotel className="w-5 h-5" />,
  },
  {
    label: 'Sales & Disposals',
    to: '/owner/sales',
    icon: <BadgeDollarSign className="w-5 h-5" />,
  },
  {
    label: 'Reservations',
    to: '/owner/reservations',
    icon: <Calendar className="w-5 h-5" />,
  },
  {
    label: 'Tenants',
    to: '/owner/tenants',
    icon: <Users className="w-5 h-5" />,
  },
  {
    label: 'Rent & Payments',
    to: '/owner/payments',
    icon: <Wallet className="w-5 h-5" />,
  },
  {
    label: 'Expenses',
    to: '/owner/expenses',
    icon: <Receipt className="w-5 h-5" />,
  },
  {
    label: 'Viewings',
    to: '/tenant/viewings',
    icon: <Calendar className="w-5 h-5" />,
  },
  {
    label: 'Maintenance',
    to: '/owner/maintenance',
    icon: <Wrench className="w-5 h-5" />,
  },
  {
    label: 'Tax & KRA',
    to: '/owner/tax',
    icon: <TrendingUp className="w-5 h-5" />,
  },
  {
    label: 'Reports',
    to: '/owner/reports',
    icon: <FileText className="w-5 h-5" />,
  },
  {
    label: 'Documents',
    to: '/owner/documents',
    icon: <FileText className="w-5 h-5" />,
  },
  {
    label: 'Settings',
    to: '/owner/settings',
    icon: <Settings className="w-5 h-5" />,
  },
];

export const tenantNav = [
  {
    label: 'Dashboard',
    to: '/tenant',
    icon: <LayoutDashboard className="w-5 h-5" />,
  },
  {
    label: 'Find a Home',
    to: '/properties',
    icon: <Search className="w-5 h-5" />,
  },
  {
    label: 'Reservations',
    to: '/tenant/reservations',
    icon: <Calendar className="w-5 h-5" />,
  },
  {
    label: 'My House',
    to: '/tenant/house',
    icon: <Home className="w-5 h-5" />,
  },
  {
    label: 'Rent & Payments',
    to: '/tenant/rent',
    icon: <Wallet className="w-5 h-5" />,
  },
  {
    label: 'Lease',
    to: '/tenant/lease',
    icon: <FileText className="w-5 h-5" />,
  },
  {
    label: 'Viewings',
    to: '/tenant/viewings',
    icon: <Calendar className="w-5 h-5" />,
  },
  {
    label: 'Maintenance',
    to: '/tenant/maintenance',
    icon: <Wrench className="w-5 h-5" />,
  },
  {
    label: 'Messages',
    to: '/tenant/messages',
    icon: <Bell className="w-5 h-5" />,
  },
  {
    label: 'Documents',
    to: '/tenant/documents',
    icon: <FileText className="w-5 h-5" />,
  },
  {
    label: 'Settings',
    to: '/tenant/settings',
    icon: <Settings className="w-5 h-5" />,
  },
];

export const adminNav = [
  {
    label: 'Dashboard',
    to: '/admin',
    icon: <LayoutDashboard className="w-5 h-5" />,
  },
  {
    label: 'Properties',
    to: '/admin/properties',
    icon: <Building2 className="w-5 h-5" />,
  },
  {
    label: 'Portfolio & Assets',
    to: '/admin/portfolio',
    icon: <LandPlot className="w-5 h-5" />,
  },
  {
    label: 'Users',
    to: '/admin/users',
    icon: <Users className="w-5 h-5" />,
  },
  {
    label: 'Units & Inventory',
    to: '/admin/units',
    icon: <Building2 className="w-5 h-5" />,
  },
  {
    label: 'Leases & Tenants',
    to: '/admin/leases',
    icon: <Users className="w-5 h-5" />,
  },
  {
    label: 'Short-Stay Operations',
    to: '/admin/short-stay',
    icon: <Hotel className="w-5 h-5" />,
  },
  {
    label: 'Sales & Disposals',
    to: '/admin/sales',
    icon: <BadgeDollarSign className="w-5 h-5" />,
  },
  {
    label: 'Reservations',
    to: '/admin/reservations',
    icon: <Calendar className="w-5 h-5" />,
  },
  {
    label: 'Payments',
    to: '/admin/payments',
    icon: <Wallet className="w-5 h-5" />,
  },
  {
    label: 'Expenses',
    to: '/admin/expenses',
    icon: <Receipt className="w-5 h-5" />,
  },
  {
    label: 'Maintenance',
    to: '/admin/maintenance',
    icon: <Wrench className="w-5 h-5" />,
  },
  {
    label: 'Tax',
    to: '/admin/tax',
    icon: <Receipt className="w-5 h-5" />,
  },
  {
    label: 'Documents & Compliance',
    to: '/admin/documents',
    icon: <FileText className="w-5 h-5" />,
  },
  {
    label: 'Activity & Alerts',
    to: '/admin/activity',
    icon: <Activity className="w-5 h-5" />,
  },
  {
    label: 'Settings',
    to: '/admin/settings',
    icon: <Settings className="w-5 h-5" />,
  },
];

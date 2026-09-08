import { Home, LayoutDashboard, Building2, Calendar, Users, Wallet, FileText, Settings, Bell, Receipt, Wrench, TrendingUp, Search, Activity, LandPlot, Hotel, BadgeDollarSign, FileCheck2 } from 'lucide-react';

export const ownerNav = [
  {
    label: 'Dashboard',
    section: 'Overview',
    to: '/owner',
    icon: <LayoutDashboard className="w-5 h-5" />,
  },
  {
    label: 'Properties',
    section: 'Portfolio',
    to: '/owner/properties',
    icon: <Building2 className="w-5 h-5" />,
  },
  {
    label: 'Portfolio & Assets',
    section: 'Portfolio',
    to: '/owner/portfolio',
    icon: <LandPlot className="w-5 h-5" />,
  },
  {
    label: 'Short-Stay Operations',
    section: 'Operations',
    to: '/owner/short-stay',
    icon: <Hotel className="w-5 h-5" />,
  },
  {
    label: 'Sales & Disposals',
    section: 'Operations',
    to: '/owner/sales',
    icon: <BadgeDollarSign className="w-5 h-5" />,
  },
  {
    label: 'Reservations',
    section: 'Operations',
    to: '/owner/reservations',
    icon: <Calendar className="w-5 h-5" />,
  },
  {
    label: 'Tenants',
    section: 'Operations',
    to: '/owner/tenants',
    icon: <Users className="w-5 h-5" />,
  },
  {
    label: 'Rent & Payments',
    section: 'Finance',
    to: '/owner/payments',
    icon: <Wallet className="w-5 h-5" />,
  },
  {
    label: 'Expenses',
    section: 'Finance',
    to: '/owner/expenses',
    icon: <Receipt className="w-5 h-5" />,
  },
  {
    label: 'Viewings',
    section: 'Operations',
    to: '/tenant/viewings',
    icon: <Calendar className="w-5 h-5" />,
  },
  {
    label: 'Maintenance',
    section: 'Operations',
    to: '/owner/maintenance',
    icon: <Wrench className="w-5 h-5" />,
  },
  {
    label: 'Tax & KRA',
    section: 'Finance',
    to: '/owner/tax',
    icon: <TrendingUp className="w-5 h-5" />,
  },
  {
    label: 'Reports',
    section: 'Insights',
    to: '/owner/reports',
    icon: <FileText className="w-5 h-5" />,
  },
  {
    label: 'Documents',
    section: 'Administration',
    to: '/owner/documents',
    icon: <FileText className="w-5 h-5" />,
  },
  {
    label: 'Settings',
    section: 'Administration',
    to: '/owner/settings',
    icon: <Settings className="w-5 h-5" />,
  },
];

export const tenantNav = [
  {
    label: 'Dashboard',
    section: 'Overview',
    to: '/tenant',
    icon: <LayoutDashboard className="w-5 h-5" />,
  },
  {
    label: 'Find a Home',
    section: 'My tenancy',
    to: '/properties',
    icon: <Search className="w-5 h-5" />,
  },
  {
    label: 'Reservations',
    section: 'Operations',
    to: '/tenant/reservations',
    icon: <Calendar className="w-5 h-5" />,
  },
  {
    label: 'My House',
    section: 'My tenancy',
    to: '/tenant/house',
    icon: <Home className="w-5 h-5" />,
  },
  {
    label: 'Rent & Payments',
    section: 'Finance',
    to: '/tenant/rent',
    icon: <Wallet className="w-5 h-5" />,
  },
  {
    label: 'Lease',
    section: 'My tenancy',
    to: '/tenant/lease',
    icon: <FileText className="w-5 h-5" />,
  },
  {
    label: 'Viewings',
    section: 'Operations',
    to: '/tenant/viewings',
    icon: <Calendar className="w-5 h-5" />,
  },
  {
    label: 'Maintenance',
    section: 'Operations',
    to: '/tenant/maintenance',
    icon: <Wrench className="w-5 h-5" />,
  },
  {
    label: 'Messages',
    section: 'My tenancy',
    to: '/tenant/messages',
    icon: <Bell className="w-5 h-5" />,
  },
  {
    label: 'Documents',
    section: 'Administration',
    to: '/tenant/documents',
    icon: <FileText className="w-5 h-5" />,
  },
  {
    label: 'Settings',
    section: 'Administration',
    to: '/tenant/settings',
    icon: <Settings className="w-5 h-5" />,
  },
];

export const adminNav = [
  {
    label: 'Dashboard',
    section: 'Overview',
    to: '/admin',
    icon: <LayoutDashboard className="w-5 h-5" />,
  },
  {
    label: 'Properties',
    section: 'Portfolio',
    to: '/admin/properties',
    icon: <Building2 className="w-5 h-5" />,
  },
  {
    label: 'Portfolio & Assets',
    section: 'Portfolio',
    to: '/admin/portfolio',
    icon: <LandPlot className="w-5 h-5" />,
  },
  {
    label: 'Users',
    section: 'Administration',
    to: '/admin/users',
    icon: <Users className="w-5 h-5" />,
  },
  {
    label: 'Units & Inventory',
    section: 'Portfolio',
    to: '/admin/units',
    icon: <Building2 className="w-5 h-5" />,
  },
  {
    label: 'Leases & Tenants',
    section: 'Operations',
    to: '/admin/leases',
    icon: <Users className="w-5 h-5" />,
  },
  {
    label: 'Short-Stay Operations',
    section: 'Operations',
    to: '/admin/short-stay',
    icon: <Hotel className="w-5 h-5" />,
  },
  {
    label: 'Sales & Disposals',
    section: 'Operations',
    to: '/admin/sales',
    icon: <BadgeDollarSign className="w-5 h-5" />,
  },
  {
    label: 'Reservations',
    section: 'Operations',
    to: '/admin/reservations',
    icon: <Calendar className="w-5 h-5" />,
  },
  {
    label: 'Payments',
    section: 'Finance',
    to: '/admin/payments',
    icon: <Wallet className="w-5 h-5" />,
  },
  {
    label: 'Expenses',
    section: 'Finance',
    to: '/admin/expenses',
    icon: <Receipt className="w-5 h-5" />,
  },
  {
    label: 'Maintenance',
    section: 'Operations',
    to: '/admin/maintenance',
    icon: <Wrench className="w-5 h-5" />,
  },
  {
    label: 'Tax & KRA eTIMS',
    section: 'Finance',
    to: '/admin/kra',
    icon: <FileCheck2 className="w-5 h-5" />,
  },
  {
    label: 'Documents & Compliance',
    section: 'Administration',
    to: '/admin/documents',
    icon: <FileText className="w-5 h-5" />,
  },
  {
    label: 'Activity & Alerts',
    section: 'Administration',
    to: '/admin/activity',
    icon: <Activity className="w-5 h-5" />,
  },
  {
    label: 'Settings',
    section: 'Administration',
    to: '/admin/settings',
    icon: <Settings className="w-5 h-5" />,
  },
];

/* ════════════════════════════════════════════════════════════════════
   VBDS for ASTRA — the design system layer.

   Ported from ~/MyStuff/designsystem/src (VBDS v2.0, @velbloom/vbds).
   Class names and token names are unchanged; brand values and control
   density are retargeted for a desktop enterprise app. See
   docs/DESIGN-SYSTEM.md for the full mapping and deviation list.
   ════════════════════════════════════════════════════════════════════ */

export { Button, IconButton, type ButtonProps, type ButtonVariant, type IconButtonProps } from './actions';

export {
  Checkbox,
  SearchField,
  SegmentedControl,
  Select,
  Switch,
  TextArea,
  TextField,
  type CheckboxProps,
  type SearchFieldProps,
  type SegmentedControlProps,
  type SegmentedItem,
  type SelectOption,
  type SelectProps,
  type SwitchProps,
  type TextAreaProps,
  type TextFieldProps,
} from './inputs';

export {
  Avatar,
  Badge,
  Card,
  CardHeader,
  Chip,
  DescriptionItem,
  DescriptionList,
  Divider,
  EmptyState,
  ListItem,
  StatCard,
  type AvatarProps,
  type BadgeProps,
  type CardProps,
  type ChipProps,
  type EmptyStateProps,
  type ListItemProps,
  type StatCardProps,
  type Tone,
} from './display';

export { Breadcrumbs, LinkTabs, Tabs, type Crumb, type TabItem, type TabsProps } from './navigation';

export { ProgressBar, Skeleton, Spinner, StatGridSkeleton, TableSkeleton } from './feedback';

export {
  Dialog,
  Menu,
  MenuCheckboxItem,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  Sheet,
  Tooltip,
  TooltipProvider,
  type DialogProps,
  type SheetProps,
} from './overlays';

/**
 * Centralized icon exports — Phosphor Icons.
 *
 * Drop-in replacement for the previous Lucide imports. All icons share a
 * consistent `regular` weight by default so stroke width matches across the
 * app, and accept `size` / `className` / `color` exactly like before.
 *
 * App code should import from `@/components/icons`. Only shadcn/ui primitives
 * in `src/components/ui/*` still import from `lucide-react` directly because
 * they ship vendored that way.
 */
import * as Ph from "@phosphor-icons/react";
import { forwardRef, type ComponentProps } from "react";

type AnyIcon = (typeof Ph)["User"];
type IconProps = ComponentProps<AnyIcon> & {
  /** Legacy Lucide prop — ignored. Use `weight` for Phosphor stroke. */
  strokeWidth?: number | string;
  /** Legacy Lucide prop — mapped to `color`. */
  absoluteStrokeWidth?: boolean;
};

const wrap = (Component: AnyIcon, displayName: string) => {
  const Wrapped = forwardRef<SVGSVGElement, IconProps>(
    ({ strokeWidth: _sw, absoluteStrokeWidth: _asw, weight = "regular", size = 24, ...rest }, ref) => (
      <Component ref={ref as never} weight={weight} size={size} {...rest} />
    )
  );
  Wrapped.displayName = displayName;
  return Wrapped;
};

// ---- Navigation & layout ----
export const Home = wrap(Ph.House, "Home");
export const PanelLeft = wrap(Ph.SidebarSimple, "PanelLeft");
export const PanelLeftClose = wrap(Ph.Sidebar, "PanelLeftClose");
export const ArrowLeft = wrap(Ph.ArrowLeft, "ArrowLeft");
export const ArrowRight = wrap(Ph.ArrowRight, "ArrowRight");
export const ArrowRightLeft = wrap(Ph.ArrowsLeftRight, "ArrowRightLeft");
export const ArrowUpDown = wrap(Ph.ArrowsDownUp, "ArrowUpDown");
export const ArrowUpRight = wrap(Ph.ArrowUpRight, "ArrowUpRight");
export const ChevronDown = wrap(Ph.CaretDown, "ChevronDown");
export const ChevronLeft = wrap(Ph.CaretLeft, "ChevronLeft");
export const ChevronRight = wrap(Ph.CaretRight, "ChevronRight");
export const ChevronUp = wrap(Ph.CaretUp, "ChevronUp");
export const ExternalLink = wrap(Ph.ArrowSquareOut, "ExternalLink");
export const MoreHorizontal = wrap(Ph.DotsThree, "MoreHorizontal");
export const GripVertical = wrap(Ph.DotsSixVertical, "GripVertical");

// ---- Status / feedback ----
export const Check = wrap(Ph.Check, "Check");
export const CheckCircle = wrap(Ph.CheckCircle, "CheckCircle");
export const CheckCircle2 = wrap(Ph.CheckCircle, "CheckCircle2");
export const CheckSquare = wrap(Ph.CheckSquare, "CheckSquare");
export const Circle = wrap(Ph.Circle, "Circle");
export const Dot = wrap(Ph.Dot, "Dot");
export const X = wrap(Ph.X, "X");
export const XCircle = wrap(Ph.XCircle, "XCircle");
export const Minus = wrap(Ph.Minus, "Minus");
export const MinusCircle = wrap(Ph.MinusCircle, "MinusCircle");
export const Plus = wrap(Ph.Plus, "Plus");
export const AlertCircle = wrap(Ph.WarningCircle, "AlertCircle");
export const AlertTriangle = wrap(Ph.Warning, "AlertTriangle");
export const Info = wrap(Ph.Info, "Info");
export const HelpCircle = wrap(Ph.Question, "HelpCircle");
export const Loader2 = wrap(Ph.CircleNotch, "Loader2");

// ---- Actions ----
export const Edit = wrap(Ph.PencilSimple, "Edit");
export const Edit2 = wrap(Ph.PencilSimple, "Edit2");
export const Edit3 = wrap(Ph.PencilSimpleLine, "Edit3");
export const Pencil = wrap(Ph.Pencil, "Pencil");
export const Trash = wrap(Ph.Trash, "Trash");
export const Trash2 = wrap(Ph.TrashSimple, "Trash2");
export const Copy = wrap(Ph.Copy, "Copy");
export const Save = wrap(Ph.FloppyDisk, "Save");
export const Download = wrap(Ph.DownloadSimple, "Download");
export const Upload = wrap(Ph.UploadSimple, "Upload");
export const Send = wrap(Ph.PaperPlaneRight, "Send");
export const Search = wrap(Ph.MagnifyingGlass, "Search");
export const Filter = wrap(Ph.Funnel, "Filter");
export const RefreshCw = wrap(Ph.ArrowsClockwise, "RefreshCw");
export const RotateCcw = wrap(Ph.ArrowCounterClockwise, "RotateCcw");
export const Undo2 = wrap(Ph.ArrowCounterClockwise, "Undo2");
export const Redo2 = wrap(Ph.ArrowClockwise, "Redo2");
export const Play = wrap(Ph.Play, "Play");
export const Power = wrap(Ph.Power, "Power");
export const LogOut = wrap(Ph.SignOut, "LogOut");
export const Settings = wrap(Ph.Gear, "Settings");
export const Settings2 = wrap(Ph.GearSix, "Settings2");
export const Wand2 = wrap(Ph.MagicWand, "Wand2");
export const Pin = wrap(Ph.PushPin, "Pin");
export const PinOff = wrap(Ph.PushPinSlash, "PinOff");
export const Bookmark = wrap(Ph.Bookmark, "Bookmark");

// ---- Charts / analytics ----
export const Activity = wrap(Ph.ActivityIcon, "Activity");
export const BarChart3 = wrap(Ph.ChartBar, "BarChart3");
export const TrendingUp = wrap(Ph.TrendUp, "TrendingUp");
export const TrendingDown = wrap(Ph.TrendDown, "TrendingDown");
export const Presentation = wrap(Ph.Presentation, "Presentation");
export const Network = wrap(Ph.Graph, "Network");
export const Layers = wrap(Ph.Stack, "Layers");

// ---- People ----
export const User = wrap(Ph.User, "User");
export const UserCheck = wrap(Ph.UserCircleCheck, "UserCheck");
export const UserCog = wrap(Ph.UserGear, "UserCog");
export const UserPlus = wrap(Ph.UserPlus, "UserPlus");
export const Users = wrap(Ph.Users, "Users");
export const Users2 = wrap(Ph.UsersThree, "Users2");

// ---- Content / objects ----
export const FileText = wrap(Ph.FileText, "FileText");
export const FileBarChart = wrap(Ph.FileText, "FileBarChart");
export const FileSpreadsheet = wrap(Ph.FileXls, "FileSpreadsheet");
export const Folder = wrap(Ph.Folder, "Folder");
export const FolderTree = wrap(Ph.TreeStructure, "FolderTree");
export const Archive = wrap(Ph.Archive, "Archive");
export const Package = wrap(Ph.Package, "Package");
export const Database = wrap(Ph.Database, "Database");
export const Image = wrap(Ph.Image, "Image");
export const Video = wrap(Ph.VideoCamera, "Video");
export const Paperclip = wrap(Ph.Paperclip, "Paperclip");
export const Link = wrap(Ph.Link, "Link");
export const List = wrap(Ph.List, "List");
export const ListChecks = wrap(Ph.ListChecks, "ListChecks");
export const ClipboardList = wrap(Ph.ClipboardText, "ClipboardList");
export const ClipboardCheck = wrap(Ph.ClipboardText, "ClipboardCheck");
export const Tags = wrap(Ph.Tag, "Tags");

// ---- Time / calendar ----
export const Calendar = wrap(Ph.Calendar, "Calendar");
export const CalendarIcon = wrap(Ph.Calendar, "CalendarIcon");
export const CalendarCheck = wrap(Ph.CalendarCheck, "CalendarCheck");
export const CalendarClock = wrap(Ph.CalendarBlank, "CalendarClock");
export const Clock = wrap(Ph.Clock, "Clock");
export const History = wrap(Ph.ClockCounterClockwise, "History");

// ---- Domain ----
export const Award = wrap(Ph.Medal, "Award");
export const Trophy = wrap(Ph.Trophy, "Trophy");
export const Crown = wrap(Ph.Crown, "Crown");
export const Star = wrap(Ph.Star, "Star");
export const Heart = wrap(Ph.Heart, "Heart");
export const Sparkles = wrap(Ph.Sparkle, "Sparkles");
export const Lightbulb = wrap(Ph.Lightbulb, "Lightbulb");
export const Brain = wrap(Ph.Brain, "Brain");
export const Target = wrap(Ph.Target, "Target");
export const Zap = wrap(Ph.Lightning, "Zap");
export const GraduationCap = wrap(Ph.GraduationCap, "GraduationCap");
export const BookOpen = wrap(Ph.BookOpen, "BookOpen");
export const Briefcase = wrap(Ph.Briefcase, "Briefcase");
export const Building2 = wrap(Ph.Buildings, "Building2");
export const Factory = wrap(Ph.Factory, "Factory");
export const MapPin = wrap(Ph.MapPin, "MapPin");
export const Globe = wrap(Ph.Globe, "Globe");
export const DollarSign = wrap(Ph.CurrencyDollar, "DollarSign");

// ---- Communication ----
export const Mail = wrap(Ph.Envelope, "Mail");
export const Phone = wrap(Ph.Phone, "Phone");
export const Bell = wrap(Ph.Bell, "Bell");
export const MessageSquare = wrap(Ph.ChatCircle, "MessageSquare");
export const MessageSquareText = wrap(Ph.ChatCircleText, "MessageSquareText");
export const Rss = wrap(Ph.Rss, "Rss");

// ---- Security / visibility ----
export const Eye = wrap(Ph.Eye, "Eye");
export const EyeOff = wrap(Ph.EyeSlash, "EyeOff");
export const EyeOffIcon = wrap(Ph.EyeSlash, "EyeOffIcon");
export const Lock = wrap(Ph.Lock, "Lock");
export const Key = wrap(Ph.Key, "Key");
export const Shield = wrap(Ph.Shield, "Shield");
export const ShieldCheck = wrap(Ph.ShieldCheck, "ShieldCheck");

// ---- Theme ----
export const Sun = wrap(Ph.Sun, "Sun");
export const Moon = wrap(Ph.Moon, "Moon");

// ---- Aliases used in the codebase ----
export { Link as LinkIcon, Users as UsersIcon, Copy as CopyIcon };

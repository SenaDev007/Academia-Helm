import type { LucideIcon } from 'lucide-react';
import {
  Apple, Atom, Award, Backpack, Bird, BookOpen, Blocks, Calculator, CalendarCheck, Cat, Cloud,
  Compass, Crown, Fish, Flame, Flower, FlaskConical, Globe, GraduationCap, Hash, Heart,
  HeartHandshake, Landmark, Leaf, Library, Medal, Microscope, Music, PartyPopper, Palette, Pencil,
  Puzzle, Rainbow, Rocket, Ruler, Scale, Shapes, Sigma, Sparkles, Star, Sun, Telescope,
  TrendingUp, Trophy,
} from 'lucide-react';
import type { CSSProperties } from 'react';
import type { IconName } from './types.js';

const ICONS: Record<IconName, LucideIcon> = {
  Star, Sparkles, Rocket, Palette, Compass, GraduationCap, Trophy, Medal, Award, BookOpen, Pencil,
  Heart, Crown, Flame, TrendingUp, CalendarCheck, HeartHandshake, Puzzle, Shapes, Rainbow, Apple,
  Cloud, Sun, Music, Blocks, Ruler, Calculator, Globe, Backpack, Library, Microscope, Atom,
  FlaskConical, Landmark, Scale, Sigma, Telescope, Leaf, Bird, Flower, Fish, Cat, PartyPopper, Hash,
};

export function Icon(props: { name: IconName; size?: number; stroke?: number; color?: string; style?: CSSProperties }) {
  const C = ICONS[props.name];
  return <C size={props.size ?? 24} strokeWidth={props.stroke ?? 2} color={props.color ?? 'currentColor'} style={props.style} />;
}

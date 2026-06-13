import React, { useState, useCallback } from 'react';
import { BENIN_DEPARTMENTS, type DepartmentData } from './beninDepartments';

interface BeninMapProps {
  /** Callback when a department is clicked */
  onDepartmentClick?: (department: string) => void;
  /** Currently selected department name */
  selectedDepartment?: string | null;
  /** Custom color for selected department */
  selectedColor?: string;
  /** Custom color for hovered department */
  hoverColor?: string;
  /** SVG width */
  width?: number | string;
  /** SVG height */
  height?: number | string;
  /** Additional CSS class */
  className?: string;
  /** Whether to show department labels */
  showLabels?: boolean;
  /** Custom department colors (overrides defaults) */
  departmentColors?: Record<string, string>;
}

interface DepartmentPathProps {
  name: string;
  data: DepartmentData;
  fillColor: string;
  isSelected: boolean;
  isHovered: boolean;
  showLabel: boolean;
  onClick: (name: string) => void;
  onHover: (name: string | null) => void;
  selectedColor: string;
  hoverColor: string;
}

const DepartmentPath: React.FC<DepartmentPathProps> = React.memo(({
  name, data, fillColor, isSelected, isHovered, showLabel,
  onClick, onHover, selectedColor, hoverColor,
}) => {
  const fill = isSelected ? selectedColor : isHovered ? hoverColor : fillColor;
  const strokeColor = isSelected ? '#1d4ed8' : '#ffffff';
  const strokeWidth = isSelected ? 2 : isHovered ? 1.5 : 1;
  const labelSize = name === 'Littoral' ? 6 : 8;

  return (
    <g>
      <path
        d={data.d}
        fill={fill}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        style={{
          cursor: 'pointer',
          transition: 'fill 0.2s ease, stroke-width 0.2s ease',
        }}
        onClick={() => onClick(name)}
        onMouseEnter={() => onHover(name)}
        onMouseLeave={() => onHover(null)}
        data-name={name}
        data-capital={data.capital}
        data-region={data.region}
      />
      {showLabel && (
        <text
          x={data.cx}
          y={data.cy}
          textAnchor="middle"
          dominantBaseline="central"
          style={{
            fontFamily: "'Segoe UI', Arial, sans-serif",
            fontSize: labelSize,
            fill: isSelected || isHovered ? '#ffffff' : '#333333',
            pointerEvents: 'none',
            fontWeight: 600,
            userSelect: 'none',
          }}
        >
          {name}
        </text>
      )}
    </g>
  );
});

DepartmentPath.displayName = 'DepartmentPath';

const BeninMap: React.FC<BeninMapProps> = ({
  onDepartmentClick,
  selectedDepartment = null,
  selectedColor = '#2563eb',
  hoverColor = '#93c5fd',
  width = 300,
  height = 600,
  className,
  showLabels = true,
  departmentColors = {},
}) => {
  const [hoveredDepartment, setHoveredDepartment] = useState<string | null>(null);

  const handleClick = useCallback((name: string) => {
    onDepartmentClick?.(name);
  }, [onDepartmentClick]);

  const handleHover = useCallback((name: string | null) => {
    setHoveredDepartment(name);
  }, []);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 300 600"
      width={width}
      height={height}
      className={className}
      role="img"
      aria-label="Map of Benin departments"
    >
      {Object.entries(BENIN_DEPARTMENTS).map(([name, data]) => (
        <DepartmentPath
          key={name}
          name={name}
          data={data}
          fillColor={departmentColors[name] || data.color}
          isSelected={selectedDepartment === name}
          isHovered={hoveredDepartment === name}
          showLabel={showLabels}
          onClick={handleClick}
          onHover={handleHover}
          selectedColor={selectedColor}
          hoverColor={hoverColor}
        />
      ))}
    </svg>
  );
};

BeninMap.displayName = 'BeninMap';

export default BeninMap;

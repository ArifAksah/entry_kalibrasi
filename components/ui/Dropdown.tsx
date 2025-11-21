import React, { useState, useRef, useEffect } from 'react';

interface DropdownProps {
    trigger: React.ReactNode;
    children: React.ReactNode;
    align?: 'left' | 'right';
    className?: string;
}

const Dropdown: React.FC<DropdownProps> = ({ trigger, children, align = 'right', className = '' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return (
        <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
            <div onClick={() => setIsOpen(!isOpen)}>
                {trigger}
            </div>

            {isOpen && (
                <div
                    className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} z-50 mt-2 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none`}
                    role="menu"
                    aria-orientation="vertical"
                    aria-labelledby="menu-button"
                    tabIndex={-1}
                >
                    <div className="py-1" role="none">
                        {React.Children.map(children, (child) => {
                            if (React.isValidElement(child)) {
                                const childElement = child as React.ReactElement<any>;
                                return React.cloneElement(childElement, {
                                    onClick: (e: React.MouseEvent) => {
                                        if (childElement.props.onClick) {
                                            childElement.props.onClick(e);
                                        }
                                        setIsOpen(false);
                                    }
                                });
                            }
                            return child;
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

interface DropdownItemProps {
    children: React.ReactNode;
    icon?: React.ReactNode;
    variant?: 'default' | 'danger' | 'warning';
    href?: string;
    target?: string;
    onClick?: (e: React.MouseEvent) => void;
    className?: string;
}

export const DropdownItem: React.FC<DropdownItemProps> = ({ children, icon, variant = 'default', href, target, className = '', onClick, ...props }) => {
    const baseClasses = "group flex w-full items-center px-4 py-2 text-sm text-left";
    const variantClasses = {
        default: "text-gray-700 hover:bg-gray-100 hover:text-gray-900",
        danger: "text-red-700 hover:bg-red-50 hover:text-red-900",
        warning: "text-yellow-700 hover:bg-yellow-50 hover:text-yellow-900"
    };

    const content = (
        <>
            {icon && (
                <span className={`mr-3 h-5 w-5 ${variant === 'danger' ? 'text-red-400 group-hover:text-red-500' : 'text-gray-400 group-hover:text-gray-500'}`}>
                    {icon}
                </span>
            )}
            {children}
        </>
    );

    if (href) {
        return (
            <a
                href={href}
                target={target}
                className={`${baseClasses} ${variantClasses[variant]} ${className}`}
                onClick={onClick}
            >
                {content}
            </a>
        );
    }

    return (
        <button
            className={`${baseClasses} ${variantClasses[variant]} ${className}`}
            onClick={onClick}
            {...props}
        >
            {content}
        </button>
    );
};

export default Dropdown;

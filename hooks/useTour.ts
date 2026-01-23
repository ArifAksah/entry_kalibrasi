import { useEffect, useRef } from 'react';
import { driver, DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';

interface UseTourProps {
    steps: DriveStep[];
}

export const useTour = ({ steps }: UseTourProps) => {
    const driverObj = useRef<ReturnType<typeof driver> | null>(null);

    useEffect(() => {
        driverObj.current = driver({
            showProgress: true,
            steps: steps
        });

        return () => {
            driverObj.current?.destroy();
        };
    }, [steps]);

    const startTour = () => {
        driverObj.current?.drive();
    };

    return { startTour, driverObj };
};

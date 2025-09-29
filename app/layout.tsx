import React from 'react';
import './globals.css';
import { AuthProvider } from '../contexts/AuthContext';

const RootLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <html lang="en">
            <body className="bg-gray-50 text-slate-900 antialiased">
                <AuthProvider>
                    <div className="min-h-screen">
                        {children}
                    </div>
                </AuthProvider>
            </body>
        </html>
    );
};

export default RootLayout;
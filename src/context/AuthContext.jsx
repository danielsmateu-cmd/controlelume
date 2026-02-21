import React, { createContext, useContext, useState } from 'react';
import { authenticate, ROLE_PERMISSIONS } from '../data/users';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(() => {
        const saved = sessionStorage.getItem('currentUser');
        return saved ? JSON.parse(saved) : null;
    });

    const login = (loginInput, password) => {
        const user = authenticate(loginInput, password);
        if (user) {
            setCurrentUser(user);
            sessionStorage.setItem('currentUser', JSON.stringify(user));
            return true;
        }
        return false;
    };

    const logout = () => {
        setCurrentUser(null);
        sessionStorage.removeItem('currentUser');
    };

    const permissions = currentUser ? ROLE_PERMISSIONS[currentUser.role] : null;

    const canEdit = (tab) => permissions?.editableTabs.includes(tab);
    const canView = (tab) => permissions?.visibleTabs.includes(tab);

    return (
        <AuthContext.Provider value={{ currentUser, login, logout, permissions, canEdit, canView }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}

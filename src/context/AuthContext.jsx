import React, { createContext, useContext, useState, useEffect } from 'react';
import { USERS, ROLE_PERMISSIONS } from '../data/users';
import { api } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(() => {
        const saved = sessionStorage.getItem('currentUser');
        return saved ? JSON.parse(saved) : null;
    });

    const [usersList, setUsersList] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(true);

    useEffect(() => {
        const loadUsers = async () => {
            setLoadingUsers(true);
            try {
                const savedUsers = await api.getSettings('system_users');
                if (savedUsers && savedUsers.length > 0) {
                    let migrated = false;
                    const updatedUsers = savedUsers.map(u => {
                        // Se for admin, editor, ou login for dsmateu/teste/jsmateu/bsmateu e tiver customPermissions
                        const isEligible = u.role === 'admin' || u.role === 'editor' || u.login === 'dsmateu' || u.login === 'teste' || u.login === 'jsmateu' || u.login === 'bsmateu';
                        
                        if (isEligible && u.customPermissions) {
                            const vis = u.customPermissions.visibleTabs || [];
                            const edi = u.customPermissions.editableTabs || [];
                            
                            const needsVis = !vis.includes('estudo_produtos');
                            const needsEdi = !edi.includes('estudo_produtos');
                            
                            if (needsVis || needsEdi) {
                                migrated = true;
                                return {
                                    ...u,
                                    customPermissions: {
                                        ...u.customPermissions,
                                        visibleTabs: needsVis ? [...vis, 'estudo_produtos'] : vis,
                                        editableTabs: needsEdi ? [...edi, 'estudo_produtos'] : edi
                                    }
                                };
                            }
                        }
                        return u;
                    });

                    if (migrated) {
                        console.log('Migrating system_users to include estudo_produtos...');
                        await api.saveSettings('system_users', updatedUsers);
                        setUsersList(updatedUsers);
                        
                        // Atualizar também o currentUser do sessionStorage caso seja o usuário ativo
                        const mySession = sessionStorage.getItem('currentUser');
                        if (mySession) {
                            const parsed = JSON.parse(mySession);
                            const updatedMe = updatedUsers.find(x => x.id === parsed.id);
                            if (updatedMe) {
                                sessionStorage.setItem('currentUser', JSON.stringify(updatedMe));
                                setCurrentUser(updatedMe);
                            }
                        }
                    } else {
                        setUsersList(savedUsers);
                    }
                } else {
                    setUsersList(USERS);
                    await api.saveSettings('system_users', USERS);
                }
            } catch (err) {
                console.error("Erro ao carregar usuarios:", err);
                setUsersList(USERS);
            } finally {
                setLoadingUsers(false);
            }
        };
        loadUsers();
    }, []);

    const login = (loginInput, password) => {
        const user = usersList.find(u => u.login === loginInput && u.password === password);
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

    const saveUsersList = async (newList) => {
        setUsersList(newList);
        await api.saveSettings('system_users', newList);
        
        // If current user is modified, update session storage
        if (currentUser) {
            const updatedMe = newList.find(u => u.id === currentUser.id);
            if (updatedMe) {
                setCurrentUser(updatedMe);
                sessionStorage.setItem('currentUser', JSON.stringify(updatedMe));
            } else {
                logout(); // My user was deleted
            }
        }
    };

    // Calculate active permissions dynamically
    const activeUser = currentUser ? usersList.find(u => u.id === currentUser.id) : null;
    const permissions = activeUser?.customPermissions || (activeUser ? ROLE_PERMISSIONS[activeUser.role] : null);

    const canEdit = (tab) => permissions?.editableTabs?.includes(tab);
    const canView = (tab) => permissions?.visibleTabs?.includes(tab);

    return (
        <AuthContext.Provider value={{ 
            currentUser, 
            login, 
            logout, 
            permissions, 
            canEdit, 
            canView,
            usersList,
            loadingUsers,
            saveUsersList
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'jobManagerSettings';
const DEFAULT_SETTINGS = {
    visibleJobTypes: {
        'get_tokens_balances_batch': false,
        'burn_tokens_batch': true,
        'burn_each_tokens': true,
        'close_accounts': true,
        'close_token_account': true,
        'close_token_accounts_batch': true,
        'refund_wallets': true,
        'distribute_sol': true,
        'create_token': true,
        'burn_tokens': true,
        'other': true, // Pour les types de jobs non spécifiés
    },
    showCompleted: true,
    showFailed: true,
    showCancelled: true,
    autoRefresh: true,
    maxJobsToKeep: 50,
};

export default function useJobManagerSettings() {
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);

    // Charger les paramètres depuis localStorage au démarrage
    useEffect(() => {
        try {
            const savedSettings = localStorage.getItem(STORAGE_KEY);
            if (savedSettings) {
                const parsed = JSON.parse(savedSettings);
                // Merger avec les paramètres par défaut pour gérer les nouveaux paramètres
                setSettings(prev => ({
                    ...prev,
                    ...parsed,
                    visibleJobTypes: {
                        ...prev.visibleJobTypes,
                        ...parsed.visibleJobTypes,
                    }
                }));
            }
        } catch (error) {
            console.error('Error loading job manager settings:', error);
        }
    }, []);

    // Sauvegarder les paramètres dans localStorage à chaque changement
    const updateSettings = (newSettings) => {
        try {
            const updatedSettings = typeof newSettings === 'function'
                ? newSettings(settings)
                : { ...settings, ...newSettings };

            setSettings(updatedSettings);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSettings));
        } catch (error) {
            console.error('Error saving job manager settings:', error);
        }
    };

    // Fonctions utilitaires
    const toggleJobType = (jobType) => {
        updateSettings(prev => ({
            ...prev,
            visibleJobTypes: {
                ...prev.visibleJobTypes,
                [jobType]: !prev.visibleJobTypes[jobType],
            }
        }));
    };

    const toggleAllJobTypes = (visible) => {
        updateSettings(prev => ({
            ...prev,
            visibleJobTypes: Object.keys(prev.visibleJobTypes).reduce((acc, key) => {
                acc[key] = visible;
                return acc;
            }, {})
        }));
    };

    const resetSettings = () => {
        setSettings(DEFAULT_SETTINGS);
        localStorage.removeItem(STORAGE_KEY);
    };

    // Fonction pour filtrer les jobs selon les paramètres
    const filterJobs = (jobs) => {
        let filteredJobs = jobs.filter(job => {
            // Filtrer par type de job
            const jobType = job.name || job.type || 'other'; // Utiliser 'name' ou 'type'
            const isJobTypeVisible = settings.visibleJobTypes[jobType] !== false;

            // Filtrer par statut
            const jobState = job.state || job.status; // Utiliser 'state' ou 'status'
            const isStatusVisible =
                (jobState === 'Completed' && settings.showCompleted) ||
                (jobState === 'completed' && settings.showCompleted) ||
                ((jobState?.Failed || jobState === 'failed') && settings.showFailed) ||
                (jobState === 'Cancelled' && settings.showCancelled) ||
                (jobState === 'cancelled' && settings.showCancelled) ||
                (jobState === 'Running' || jobState === 'Pending' || jobState === 'running' || jobState === 'pending');

            return isJobTypeVisible && isStatusVisible;
        });

        // Limiter le nombre de jobs selon les paramètres
        if (filteredJobs.length > settings.maxJobsToKeep) {
            // Trier par date de début (plus récents en premier) et garder seulement le nombre maximal
            filteredJobs = filteredJobs
                .sort((a, b) => new Date(b.timestamp || b.startTime || 0) - new Date(a.timestamp || a.startTime || 0))
                .slice(0, settings.maxJobsToKeep);
        }

        return filteredJobs;
    };    // Obtenir la liste des types de jobs uniques
    const getJobTypes = (jobs) => {
        const types = new Set();
        jobs.forEach(job => {
            types.add(job.name || job.type || 'other'); // Utiliser 'name' ou 'type'
        });
        return Array.from(types).sort();
    };

    return {
        settings,
        updateSettings,
        toggleJobType,
        toggleAllJobTypes,
        resetSettings,
        filterJobs,
        getJobTypes,
    };
}

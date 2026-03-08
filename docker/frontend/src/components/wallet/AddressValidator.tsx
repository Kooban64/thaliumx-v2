'use client';

import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface AddressValidatorProps {
  address: string;
  network?: string;
  onValidationChange: (isValid: boolean) => void;
}

/**
 * AddressValidator - Validates cryptocurrency addresses
 */
export function AddressValidator({ address, network, onValidationChange }: AddressValidatorProps) {
  const [isValid, setIsValid] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!address) {
      setIsValid(false);
      onValidationChange(false);
      setError('');
      return;
    }

    setIsValidating(true);
    
    // Basic validation - check address format
    const validateAddress = async () => {
      try {
        // For Ethereum addresses (0x followed by 40 hex characters)
        if (network?.toLowerCase().includes('ethereum') || network?.toLowerCase().includes('evm')) {
          const ethPattern = /^0x[a-fA-F0-9]{40}$/;
          if (ethPattern.test(address)) {
            setIsValid(true);
            setError('');
            onValidationChange(true);
          } else {
            setIsValid(false);
            setError('Invalid Ethereum address format');
            onValidationChange(false);
          }
        }
        // For Bitcoin addresses (starts with 1, 3, or bc1)
        else if (network?.toLowerCase().includes('bitcoin') || network?.toLowerCase().includes('btc')) {
          const btcPattern = /^(1|3|bc1)[a-zA-Z0-9]{25,62}$/;
          if (btcPattern.test(address)) {
            setIsValid(true);
            setError('');
            onValidationChange(true);
          } else {
            setIsValid(false);
            setError('Invalid Bitcoin address format');
            onValidationChange(false);
          }
        }
        // Generic validation - at least 20 characters
        else {
          if (address.length >= 20 && address.length <= 100) {
            setIsValid(true);
            setError('');
            onValidationChange(true);
          } else {
            setIsValid(false);
            setError('Invalid address format');
            onValidationChange(false);
          }
        }
      } catch {
        setIsValid(false);
        setError('Validation error');
        onValidationChange(false);
      } finally {
        setIsValidating(false);
      }
    };

    const timeout = setTimeout(validateAddress, 500); // Debounce
    return () => clearTimeout(timeout);
  }, [address, network, onValidationChange]);

  if (!address) return null;

  if (isValidating) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Validating address...
      </div>
    );
  }

  if (isValid) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600">
        <CheckCircle className="h-4 w-4" />
        Valid address
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="py-2">
        <XCircle className="h-4 w-4" />
        <AlertDescription className="text-sm">{error}</AlertDescription>
      </Alert>
    );
  }

  return null;
}

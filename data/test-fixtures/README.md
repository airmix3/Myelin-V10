# Test Fixtures

## eeg-sample.csv
Synthetic 4-channel EEG recording for acceptance Scenario B.
- Channels: Fp1, Fp2, C3, C4 (standard 10-20 placement)
- Sample rate: 256 Hz
- Duration: 10 seconds (2560 samples)
- Labels: 0 = rest (first 5s), 1 = motor_imagery (last 5s)
- Rest epochs: 10Hz alpha rhythm with low-amplitude noise (~5uV)
- Motor imagery epochs: 20Hz beta rhythm on C3/C4 with higher amplitude (~12uV), Fp1/Fp2 unchanged
- Use with scikit-learn SVM for binary classification on C3/C4 features
- Expected SVM accuracy: ~70-85% (C3/C4 have distinct amplitude/frequency patterns between conditions)

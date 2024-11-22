import React, { createContext, useContext, useState } from 'react'

interface FileContextType {
  files: {
    main: { content: string; filename: string; } | null;
    summary: { content: string; filename: string; } | null;
  };
  tables: {
    main: { columns: any[]; data: any[]; } | null;
    summary: { columns: any[]; data: any[]; } | null;
  };
  setFiles: (files: any) => void;
  setTables: (tables: any) => void;
}

const FileContext = createContext<FileContextType | undefined>(undefined)

export function FileProvider({ children }: { children: React.ReactNode }) {
  const [files, setFiles] = useState<FileContextType['files']>({
    main: null,
    summary: null
  })

  const [tables, setTables] = useState<FileContextType['tables']>({
    main: null,
    summary: null
  })

  return (
    <FileContext.Provider value={{ files, tables, setFiles, setTables }}>
      {children}
    </FileContext.Provider>
  )
}

export function useFiles() {
  const context = useContext(FileContext)
  if (context === undefined) {
    throw new Error('useFiles must be used within a FileProvider')
  }
  return context
} 
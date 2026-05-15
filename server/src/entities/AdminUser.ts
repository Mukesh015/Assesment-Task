import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity({ name: 'admin_users' })
export class AdminUser {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ type: 'varchar', length: 80, unique: true })
  username!: string

  @Column({ type: 'varchar', length: 255 })
  passwordHash!: string

  @CreateDateColumn()
  createdAt!: Date
}

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm'
import { Nominee } from './Nominee'
import { Poll } from './Poll'

@Entity({ name: 'votes' })
@Index(['sessionId'], { unique: true })
export class Vote {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ type: 'varchar', length: 100 })
  sessionId!: string

  @Column({ type: 'int' })
  nomineeId!: number

  @Column({ type: 'int', nullable: true })
  pollId!: number | null

  @ManyToOne(() => Poll, (poll) => poll.votes, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'pollId' })
  poll!: Poll | null

  @ManyToOne(() => Nominee, (nominee) => nominee.votes, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'nomineeId' })
  nominee!: Nominee

  @CreateDateColumn()
  createdAt!: Date
}
